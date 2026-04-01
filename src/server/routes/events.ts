import { Router } from "express";
import prisma from "../../db/client.js";

const router = Router();

// GET /events?season=YYYY
router.get("/", async (req, res) => {
  const { season } = req.query;

  const events = await prisma.event.findMany({
    where: season ? { seasonYear: Number(season) } : undefined,
    include: { circuit: true, sessions: true },
    orderBy: [{ seasonYear: "desc" }, { round: "asc" }],
  });

  res.json(events);
});

// GET /events/:id
router.get("/:id", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: {
      circuit: true,
      sessions: {
        include: {
          results: {
            include: { driver: true, constructor: true },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });

  if (!event) return res.status(404).json({ error: "Event not found" });
  res.json(event);
});

export default router;
