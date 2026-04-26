import { Router } from "express";
import prisma from "../../db/client.js";
const router = Router();
// GET /seasons
router.get("/", async (_req, res) => {
    const seasons = await prisma.season.findMany({
        orderBy: { year: "desc" },
    });
    res.json(seasons);
});
// GET /seasons/:year
router.get("/:year", async (req, res) => {
    const year = Number(req.params.year);
    const season = await prisma.season.findUnique({
        where: { year },
        include: {
            events: {
                include: { circuit: true },
                orderBy: { round: "asc" },
            },
        },
    });
    if (!season)
        return res.status(404).json({ error: "Season not found" });
    res.json(season);
});
export default router;
//# sourceMappingURL=seasons.js.map