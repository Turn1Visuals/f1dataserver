import { Router } from "express";
const router = Router();
const F1_API_URL = "https://api.formula1.com/v1/event-tracker";
const F1_API_KEY = "xZ7AOODSjiQadLsIYWefQrpCSQVDbHGC";
const CACHE_TTL_MS = 60 * 1000; // 1 minute
let cache = null;
router.get("/", async (_req, res) => {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
        res.json(cache.data);
        return;
    }
    try {
        const response = await fetch(F1_API_URL, {
            headers: {
                apikey: F1_API_KEY,
                locale: "en",
                "content-type": "application/json",
            },
            signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
            res.status(response.status).json({ error: `F1 API returned ${response.status}` });
            return;
        }
        const data = await response.json();
        cache = { data, fetchedAt: Date.now() };
        res.json(data);
    }
    catch (e) {
        if (cache) {
            // Return stale cache on error
            res.json(cache.data);
            return;
        }
        res.status(502).json({ error: e.message });
    }
});
export default router;
//# sourceMappingURL=event-tracker.js.map