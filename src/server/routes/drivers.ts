import { Router } from "express";
import prisma from "../../db/client.js";

const router = Router();

// GET /drivers — all drivers, optional ?season=YYYY
router.get("/", async (req, res) => {
  const { season } = req.query;

  const drivers = await prisma.driver.findMany({
    where: season
      ? {
          driverSeasons: {
            some: { seasonYear: Number(season) },
          },
        }
      : undefined,
    include: season
      ? {
          driverSeasons: {
            where: { seasonYear: Number(season) },
            include: { constructor: true },
          },
        }
      : undefined,
    orderBy: { lastName: "asc" },
  });

  res.json(drivers);
});

// GET /drivers/:id
router.get("/:id", async (req, res) => {
  const driver = await prisma.driver.findUnique({
    where: { id: req.params.id },
    include: {
      driverSeasons: { include: { constructor: true } },
    },
  });

  if (!driver) return res.status(404).json({ error: "Driver not found" });
  res.json(driver);
});

export default router;
