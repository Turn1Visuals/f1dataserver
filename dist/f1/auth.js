import { spawn } from "child_process";
import { existsSync, writeFileSync, readFileSync, unlinkSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import WebSocket from "ws";
const __dirname = dirname(fileURLToPath(import.meta.url));
const F1_LOGIN_URL = "https://account.formula1.com/#/en/login?redirect=https%3A%2F%2Ff1tv.formula1.com%2F";
const COOKIE_NAME = "login-session";
const DATA_DIR = process.env["F1_DATA_DIR"] ?? join(__dirname, "../..");
const TOKEN_FILE = join(DATA_DIR, ".f1token.json");
// Persistent Chrome profile — user logs in once, session cookie is reused on future logins
const CHROME_PROFILE_DIR = join(DATA_DIR, ".chrome-profile");
const DEBUG_PORT = 9229;
const LOGIN_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
let loginPending = false;
// ── Token storage ─────────────────────────────────────────────────────────────
export function saveToken(token) {
    writeFileSync(TOKEN_FILE, JSON.stringify({ token, savedAt: new Date().toISOString() }), "utf-8");
}
export function loadToken() {
    // Priority: .f1token.json → F1_TOKEN env
    try {
        if (existsSync(TOKEN_FILE)) {
            const { token } = JSON.parse(readFileSync(TOKEN_FILE, "utf-8"));
            if (!_isExpired(token))
                return token;
        }
        return process.env["F1_TOKEN"] ?? null;
    }
    catch {
        return process.env["F1_TOKEN"] ?? null;
    }
}
export function clearToken() {
    try {
        unlinkSync(TOKEN_FILE);
    }
    catch { }
}
export function getTokenStatus() {
    const pending = loginPending;
    try {
        const token = loadToken();
        if (!token)
            return { loggedIn: false, expiresAt: null, pending };
        const exp = _getExp(token);
        return {
            loggedIn: true,
            expiresAt: exp ? new Date(exp * 1000).toISOString() : null,
            pending,
        };
    }
    catch {
        return { loggedIn: false, expiresAt: null, pending };
    }
}
// ── Browser login ─────────────────────────────────────────────────────────────
export async function startLogin() {
    if (loginPending)
        throw new Error("Login already in progress");
    const chromePath = _findChrome();
    if (!chromePath)
        throw new Error("Google Chrome not found — install Chrome to use F1 login");
    loginPending = true;
    console.log("[f1/auth] Opening Chrome for F1 login...");
    mkdirSync(CHROME_PROFILE_DIR, { recursive: true });
    const chrome = spawn(chromePath, [
        `--remote-debugging-port=${DEBUG_PORT}`,
        `--user-data-dir=${CHROME_PROFILE_DIR}`,
        "--no-first-run",
        "--no-default-browser-check",
        F1_LOGIN_URL,
    ], { detached: false, stdio: "ignore" });
    chrome.on("error", (err) => {
        loginPending = false;
        console.error("[f1/auth] Chrome error:", err.message);
    });
    // Poll for the login cookie via CDP
    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    let token = null;
    await new Promise((resolve, reject) => {
        // Give Chrome 2 seconds to start
        setTimeout(async () => {
            let attempts = 0;
            const interval = setInterval(async () => {
                attempts++;
                if (Date.now() > deadline) {
                    clearInterval(interval);
                    chrome.kill();
                    loginPending = false;
                    reject(new Error("Login timeout — no token received after 3 minutes"));
                    return;
                }
                try {
                    console.log(`[f1/auth] Poll #${attempts} — calling CDP...`);
                    token = await _getCookieViaCDP();
                    console.log(`[f1/auth] Poll #${attempts} — token: ${token ? "found" : "not yet"}`);
                    if (token) {
                        clearInterval(interval);
                        chrome.kill();
                        loginPending = false;
                        saveToken(token);
                        console.log("[f1/auth] Token saved successfully");
                        resolve();
                    }
                }
                catch {
                    // CDP not ready yet or page not loaded — keep polling
                }
            }, 1000);
        }, 2000);
    });
}
// ── Chrome helpers ────────────────────────────────────────────────────────────
function _findChrome() {
    const candidates = [
        process.env["PROGRAMFILES"] ? join(process.env["PROGRAMFILES"], "Google/Chrome/Application/chrome.exe") : null,
        process.env["PROGRAMFILES(X86)"] ? join(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe") : null,
        process.env["LOCALAPPDATA"] ? join(process.env["LOCALAPPDATA"], "Google/Chrome/Application/chrome.exe") : null,
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    ].filter(Boolean);
    return candidates.find((p) => existsSync(p)) ?? null;
}
async function _getCookieViaCDP() {
    // Get list of debuggable targets
    let targets;
    try {
        const res = await fetch(`http://localhost:${DEBUG_PORT}/json/list`);
        if (!res.ok)
            return null;
        targets = await res.json();
    }
    catch {
        return null; // Chrome not ready yet
    }
    // Prefer a page target, fall back to any with a debugger URL
    const target = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl) ??
        targets.find((t) => t.webSocketDebuggerUrl);
    if (!target?.webSocketDebuggerUrl)
        return null;
    return new Promise((resolve, reject) => {
        let settled = false;
        const settle = (val) => { if (!settled) {
            settled = true;
            resolve(val);
        } };
        const ws = new WebSocket(target.webSocketDebuggerUrl);
        const timeout = setTimeout(() => { ws.terminate(); if (!settled) {
            settled = true;
            reject(new Error("CDP timeout"));
        } }, 5000);
        ws.on("open", () => {
            // getAllCookies returns all cookies regardless of domain/URL — avoids domain matching issues
            ws.send(JSON.stringify({ id: 1, method: "Network.getAllCookies" }));
        });
        ws.on("message", (raw) => {
            clearTimeout(timeout);
            // Mark settled and terminate BEFORE any async work so the error handler can't fire a spurious reject
            settled = true;
            ws.terminate();
            try {
                const msg = JSON.parse(raw.toString());
                const cookies = msg.result?.cookies ?? [];
                const cookie = cookies.find((c) => c.name === COOKIE_NAME && c.domain.includes("formula1.com"));
                if (!cookie) {
                    console.log(`[f1/auth] CDP: ${cookies.length} cookies found, no ${COOKIE_NAME} yet`);
                    resolve(null);
                    return;
                }
                console.log("[f1/auth] Found login-session cookie — extracting token...");
                console.log("[f1/auth] Cookie value (first 120 chars):", cookie.value.slice(0, 120));
                let parsed;
                try {
                    parsed = JSON.parse(decodeURIComponent(cookie.value));
                }
                catch {
                    // Some browsers double-encode or don't encode — try parsing directly
                    try {
                        parsed = JSON.parse(cookie.value);
                    }
                    catch (e2) {
                        console.log("[f1/auth] Could not parse cookie value:", e2.message);
                        resolve(null);
                        return;
                    }
                }
                console.log("[f1/auth] Parsed keys:", Object.keys(parsed));
                const token = parsed.data?.subscriptionToken ?? null;
                if (!token)
                    console.log("[f1/auth] No subscriptionToken — data keys:", Object.keys(parsed.data ?? {}));
                resolve(token);
            }
            catch (e) {
                console.log("[f1/auth] CDP parse error:", e.message);
                resolve(null);
            }
        });
        ws.on("error", (err) => { clearTimeout(timeout); if (!settled) {
            settled = true;
            reject(err);
        } });
    });
}
function _getExp(token) {
    try {
        const payload = token.split(".")[1];
        if (!payload)
            return null;
        const { exp } = JSON.parse(Buffer.from(payload, "base64").toString());
        return exp ?? null;
    }
    catch {
        return null;
    }
}
function _isExpired(token) {
    const exp = _getExp(token);
    return exp !== null && Date.now() / 1000 > exp;
}
//# sourceMappingURL=auth.js.map