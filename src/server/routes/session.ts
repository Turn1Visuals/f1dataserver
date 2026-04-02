import { Router } from "express";
import { sessionManager } from "../../f1/session-manager.js";
import { loadToken } from "../../f1/auth.js";
import { isCached, readCache } from "../../f1/cache.js";
import { inflateRaw } from "zlib";
import { promisify } from "util";

const inflateRawAsync = promisify(inflateRaw);

async function parseData(data: unknown): Promise<unknown> {
  if (typeof data === "string") {
    const buf = Buffer.from(data, "base64");
    const raw = await inflateRawAsync(buf);
    return JSON.parse(raw.toString("utf-8"));
  }
  return data;
}

function deepMerge(target: unknown, source: unknown): unknown {
  if (source === null || typeof source !== "object" || Array.isArray(source)) return source;
  if (target === null || typeof target !== "object" || Array.isArray(target)) target = {};
  const t = target as Record<string, unknown>;
  const s = source as Record<string, unknown>;
  for (const [key, val] of Object.entries(s)) {
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      t[key] = deepMerge(t[key] ?? {}, val);
    } else {
      t[key] = val;
    }
  }
  return t;
}

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
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

router.post("/live/disconnect", (_req, res) => {
  sessionManager.disconnectLive();
  res.json({ ok: true });
});

// ── Playback ─────────────────────────────────────────────────────────────────

router.post("/load", async (req, res) => {
  const { sessionPath } = req.body as { sessionPath?: string };
  if (!sessionPath) {
    res.status(400).json({ ok: false, error: "sessionPath required" });
    return;
  }
  try {
    const result = await sessionManager.loadSession(sessionPath);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

router.post("/play", (req, res) => {
  const { speed } = req.body as { speed?: number };
  sessionManager.play(speed ?? 1);
  res.json({ ok: true, ...sessionManager.getStatus() });
});

router.post("/pause", (_req, res) => {
  sessionManager.pause();
  res.json({ ok: true, ...sessionManager.getStatus() });
});

router.post("/seek", async (req, res) => {
  const { offsetMs } = req.body as { offsetMs?: number };
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
  const { ms } = req.body as { ms?: number };
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
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/cached", (_req, res) => {
  res.json(sessionManager.getCachedSessions());
});

// ── Final state (fetch if needed + return merged end state) ───────────────────

router.post("/final-state", async (req, res) => {
  const { sessionPath } = req.body as { sessionPath?: string };
  if (!sessionPath) {
    res.status(400).json({ error: "sessionPath required" });
    return;
  }
  try {
    if (!isCached(sessionPath)) {
      await sessionManager.loadSession(sessionPath);
    }
    const timeline = readCache(sessionPath);
    const state: Record<string, unknown> = {};
    for (const event of timeline) {
      const parsed = await parseData(event.data).catch(() => null);
      if (parsed != null) {
        state[event.topic] = deepMerge(state[event.topic] ?? {}, parsed);
      }
    }
    res.json(state);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ── Snapshot ──────────────────────────────────────────────────────────────────

// GET /session/snapshot/final?path=2026/event/session/
router.get("/snapshot/final", async (req, res) => {
  const sessionPath = String(req.query["path"] ?? "");
  if (!sessionPath) {
    res.status(400).json({ error: "path query parameter required" });
    return;
  }
  if (!isCached(sessionPath)) {
    res.status(404).json({ error: "Session not cached" });
    return;
  }
  try {
    const timeline = readCache(sessionPath);
    const state: Record<string, unknown> = {};
    for (const event of timeline) {
      const parsed = await parseData(event.data).catch(() => null);
      if (parsed != null) {
        state[event.topic] = deepMerge(state[event.topic] ?? {}, parsed);
      }
    }
    res.json(state);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/snapshot", (_req, res) => {
  const snapshot = sessionManager.getSnapshot();
  if (Object.keys(snapshot).length === 0) {
    res.status(404).json({ error: "No snapshot available — no active session" });
    return;
  }
  res.json(snapshot);
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
