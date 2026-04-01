import { Router } from "express";
import prisma from "../../db/client.js";

const router = Router();

// GET /circuits
router.get("/", async (_req, res) => {
  const circuits = await prisma.circuit.findMany({
    orderBy: { name: "asc" },
  });
  res.json(circuits);
});

// GET /circuits/:id
router.get("/:id", async (req, res) => {
  const circuit = await prisma.circuit.findUnique({
    where: { id: req.params.id },
    include: { events: { orderBy: { date: "desc" }, take: 10 } },
  });

  if (!circuit) return res.status(404).json({ error: "Circuit not found" });
  res.json(circuit);
});

export default router;
