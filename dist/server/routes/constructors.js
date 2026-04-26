import { Router } from "express";
import prisma from "../../db/client.js";
const router = Router();
// GET /constructors — all constructors, optional ?season=YYYY
router.get("/", async (req, res) => {
    const { season } = req.query;
    const constructors = await prisma.constructor.findMany({
        where: season
            ? {
                driverSeasons: {
                    some: { seasonYear: Number(season) },
                },
            }
            : undefined,
        orderBy: { name: "asc" },
    });
    res.json(constructors);
});
// GET /constructors/:id
router.get("/:id", async (req, res) => {
    const constructor = await prisma.constructor.findUnique({
        where: { id: req.params.id },
        include: {
            driverSeasons: { include: { driver: true } },
        },
    });
    if (!constructor)
        return res.status(404).json({ error: "Constructor not found" });
    res.json(constructor);
});
// PATCH /constructors/:id/meta
router.patch("/:id/meta", async (req, res) => {
    const { f1Slug } = req.body;
    const constructor = await prisma.constructor.update({
        where: { id: req.params.id },
        data: { f1Slug: f1Slug ?? null },
    });
    res.json(constructor);
});
export default router;
//# sourceMappingURL=constructors.js.map