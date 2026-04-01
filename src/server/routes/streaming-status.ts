import { Router } from "express";

const router = Router();

const URL = "https://livetiming.formula1.com/static/StreamingStatus.json";
const CACHE_TTL_MS = 15 * 1000; // 15 seconds

let cache: { data: unknown; fetchedAt: number } | null = null;

router.get("/", async (_req, res) => {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    res.json(cache.data);
    return;
  }

  try {
    const response = await fetch(URL, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      res.status(response.status).json({ error: `F1 returned ${response.status}` });
      return;
    }
    const data = await response.json();
    cache = { data, fetchedAt: Date.now() };
    res.json(data);
  } catch (e) {
    if (cache) { res.json(cache.data); return; }
    res.status(502).json({ error: (e as Error).message });
  }
});

export default router;
