import { Router } from "express";
import { spawn } from "child_process";
const router = Router();
let studioProcess = null;
router.get("/status", (_req, res) => {
    res.json({ running: studioProcess !== null });
});
router.post("/start", (_req, res) => {
    if (studioProcess) {
        res.json({ running: true });
        return;
    }
    studioProcess = spawn("npm", ["run", "db:studio"], {
        shell: true,
        detached: false,
        stdio: "ignore",
    });
    studioProcess.on("exit", () => {
        studioProcess = null;
    });
    res.json({ running: true });
});
router.post("/stop", (_req, res) => {
    if (!studioProcess) {
        res.json({ running: false });
        return;
    }
    studioProcess.kill();
    studioProcess = null;
    res.json({ running: false });
});
export default router;
//# sourceMappingURL=studio.js.map