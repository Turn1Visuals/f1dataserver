import { Router } from "express";
import prisma from "../../db/client.js";

const router = Router();

// GET /standings/:year/drivers?round=5
router.get("/:year/drivers", async (req, res) => {
  const year  = parseInt(req.params["year"]!);
  const round = req.query["round"] ? parseInt(String(req.query["round"])) : null;

  try {
    const sessionWhere = round
      ? { event: { seasonYear: year, round } }
      : { event: { seasonYear: year } };

    // If no round specified, find the latest round that has standings
    const latestSession = await prisma.session.findFirst({
      where: { ...sessionWhere, driverStandings: { some: {} } },
      orderBy: { event: { round: "desc" } },
      select: { id: true, event: { select: { round: true } } },
    });

    if (!latestSession) {
      res.json([]);
      return;
    }

    const standings = await prisma.driverStanding.findMany({
      where: { sessionId: latestSession.id },
      orderBy: { position: "asc" },
      select: {
        position:      true,
        points:        true,
        wins:          true,
        constructorId: true,
        driver: { select: { id: true, code: true, firstName: true, lastName: true, nationality: true } },
      },
    });

    // Batch-fetch constructor names
    const constructorIds = [...new Set(standings.map(s => s.constructorId))];
    const constructors = await prisma.constructor.findMany({
      where: { id: { in: constructorIds } },
      select: { id: true, name: true },
    });
    const constructorMap = Object.fromEntries(constructors.map(c => [c.id, c.name]));

    res.json({
      season: year,
      round:  latestSession.event.round,
      standings: standings.map(s => ({
        position:    s.position,
        points:      s.points,
        wins:        s.wins,
        driverId:    s.driver.id,
        code:        s.driver.code,
        name:        `${s.driver.firstName} ${s.driver.lastName}`,
        nationality: s.driver.nationality,
        team:        constructorMap[s.constructorId] ?? s.constructorId,
        teamId:      s.constructorId,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /standings/:year/constructors?round=5
router.get("/:year/constructors", async (req, res) => {
  const year  = parseInt(req.params["year"]!);
  const round = req.query["round"] ? parseInt(String(req.query["round"])) : null;

  try {
    const sessionWhere = round
      ? { event: { seasonYear: year, round } }
      : { event: { seasonYear: year } };

    const latestSession = await prisma.session.findFirst({
      where: { ...sessionWhere, constructorStandings: { some: {} } },
      orderBy: { event: { round: "desc" } },
      select: { id: true, event: { select: { round: true } } },
    });

    if (!latestSession) {
      res.json([]);
      return;
    }

    const standings = await prisma.constructorStanding.findMany({
      where: { sessionId: latestSession.id },
      orderBy: { position: "asc" },
      select: {
        position: true,
        points:   true,
        wins:     true,
        constructor: { select: { id: true, name: true, nationality: true } },
      },
    });

    res.json({
      season: year,
      round:  latestSession.event.round,
      standings: standings.map(s => ({
        position:    s.position,
        points:      s.points,
        wins:        s.wins,
        teamId:      s.constructor.id,
        name:        s.constructor.name,
        nationality: s.constructor.nationality,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
