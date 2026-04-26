import { Router } from "express";
import { startLogin, getTokenStatus, clearToken } from "../../f1/auth.js";
const router = Router();
// GET /session/auth/status
router.get("/status", (_req, res) => {
    res.json(getTokenStatus());
});
// POST /session/auth/login
// Opens Chrome, user logs in, token is captured automatically.
// Returns 202 immediately — poll /status until loggedIn: true.
router.post("/login", async (_req, res) => {
    const status = getTokenStatus();
    if (status.loggedIn) {
        res.json({ ok: true, message: "Already logged in", ...status });
        return;
    }
    if (status.pending) {
        res.status(409).json({ ok: false, error: "Login already in progress — check /session/auth/status" });
        return;
    }
    // Start login in background — don't await
    res.status(202).json({ ok: true, message: "Browser opened — log in to F1 and token will be captured automatically" });
    startLogin().catch((err) => {
        console.error("[f1/auth] Login failed:", err.message);
    });
});
// POST /session/auth/logout
router.post("/logout", (_req, res) => {
    clearToken();
    res.json({ ok: true });
});
export default router;
//# sourceMappingURL=auth.js.map