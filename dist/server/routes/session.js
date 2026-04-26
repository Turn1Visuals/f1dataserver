import { Router } from "express";
import { sessionManager } from "../../f1/session-manager.js";
import { loadToken } from "../../f1/auth.js";
const router = Router();
// ── Status ───────────────────────────────────────────────────────────────────
router.get("/status", (_req, res) => {
    res.json(sessionManager.getStatus());
});
// ── Live ─────────────────────────────────────────────────────────────────────
router.post("/live", async (_req, res) => {
    const token = loadToken();
    if (!token) {
        res.status(401).json({ ok: false, error: "Not logged in — POST /session/auth/login first" });
        return;
    }
    try {
        await sessionManager.connectLive(token);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});
router.post("/live/disconnect", (_req, res) => {
    sessionManager.disconnectLive();
    res.json({ ok: true });
});
// ── Playback ─────────────────────────────────────────────────────────────────
router.post("/load", async (req, res) => {
    const { sessionPath } = req.body;
    if (!sessionPath) {
        res.status(400).json({ ok: false, error: "sessionPath required" });
        return;
    }
    try {
        const result = await sessionManager.loadSession(sessionPath);
        res.json({ ok: true, ...result });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});
router.post("/play", (req, res) => {
    const { speed } = req.body;
    sessionManager.play(speed ?? 1);
    res.json({ ok: true, ...sessionManager.getStatus() });
});
router.post("/pause", (_req, res) => {
    sessionManager.pause();
    res.json({ ok: true, ...sessionManager.getStatus() });
});
router.post("/seek", async (req, res) => {
    const { offsetMs } = req.body;
    if (offsetMs == null) {
        res.status(400).json({ ok: false, error: "offsetMs required" });
        return;
    }
    await sessionManager.seek(offsetMs);
    res.json({ ok: true, ...sessionManager.getStatus() });
});
// ── Delay ────────────────────────────────────────────────────────────────────
router.get("/delay", (_req, res) => {
    res.json({ delayMs: sessionManager.getDelay() });
});
router.post("/delay", (req, res) => {
    const { ms } = req.body;
    if (ms == null) {
        res.status(400).json({ ok: false, error: "ms required" });
        return;
    }
    sessionManager.setDelay(ms);
    res.json({ ok: true, delayMs: sessionManager.getDelay() });
});
// ── Session index ─────────────────────────────────────────────────────────────
router.get("/index", async (req, res) => {
    const year = parseInt(String(req.query["year"] ?? new Date().getFullYear()));
    try {
        const meetings = await sessionManager.getSeasonIndex(year);
        const cached = sessionManager.getCachedSessions().map((s) => s.sessionPath);
        const result = meetings.map((m) => ({
            name: m.Name,
            key: m.Key,
            location: m.Location,
            sessions: (m.Sessions ?? [])
                .filter((s) => s.Path)
                .map((s) => ({
                name: s.Name,
                path: s.Path,
                cached: cached.some((c) => c.startsWith(s.Path)),
            })),
        }));
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get("/cached", (_req, res) => {
    res.json(sessionManager.getCachedSessions());
});
// ── Circuit layout ────────────────────────────────────────────────────────────
router.get("/circuit", (_req, res) => {
    const circuit = sessionManager.getCircuit();
    if (!circuit) {
        res.status(404).json({ error: "No circuit layout loaded — connect to a session first" });
        return;
    }
    res.json(circuit);
});
export default router;
//# sourceMappingURL=session.js.map