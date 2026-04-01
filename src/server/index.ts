import "dotenv/config";
import express from "express";
import { createServer } from "http";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import prisma from "../db/client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

import seasonsRouter from "./routes/seasons.js";
import driversRouter from "./routes/drivers.js";
import constructorsRouter from "./routes/constructors.js";
import circuitsRouter from "./routes/circuits.js";
import eventsRouter from "./routes/events.js";
import sessionRouter from "./routes/session.js";
import authRouter from "./routes/auth.js";
import studioRouter from "./routes/studio.js";
import eventTrackerRouter from "./routes/event-tracker.js";
import standingsRouter from "./routes/standings.js";
import streamingStatusRouter from "./routes/streaming-status.js";
import { swaggerSpec } from "./swagger.js";
import { initWss } from "./ws.js";
import { startScheduler } from "../sync/scheduler.js";

const app = express();
const server = createServer(app);
const PORT = process.env.PORT ?? 5320;

app.use(express.json());

// Data API
app.use("/seasons", seasonsRouter);
app.use("/standings", standingsRouter);
app.use("/drivers", driversRouter);
app.use("/constructors", constructorsRouter);
app.use("/circuits", circuitsRouter);
app.use("/events", eventsRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Shutdown
app.post("/shutdown", (_req, res) => {
  res.json({ ok: true });
  setTimeout(() => process.exit(0), 200);
});

// DB stats
app.get("/stats", async (_req, res) => {
  const [sessions, results, lapTimes] = await Promise.all([
    prisma.session.count(),
    prisma.result.count(),
    prisma.lapTime.count(),
  ]);
  res.json({ sessions, results, lapTimes });
});

// Prisma Studio control
app.use("/studio", studioRouter);

// F1 session control
app.use("/session", sessionRouter);
app.use("/session/auth", authRouter);

// F1 event tracker + streaming status
app.use("/event-tracker", eventTrackerRouter);
app.use("/streaming-status", streamingStatusRouter);

// Swagger UI
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/swagger.json", (_req, res) => res.json(swaggerSpec));

// Serve React UI
const publicDir = join(__dirname, "../../public");
app.use(express.static(publicDir));
app.get("*splat", (_req, res, next) => {
  const indexPath = join(publicDir, "index.html");
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    next();
  }
});

server.listen(PORT, () => {
  console.log(`F1 Data Server running on http://localhost:${PORT}`);
  console.log(`WebSocket ready on ws://localhost:${PORT}/f1`);
  initWss(server);
  startScheduler();
});

export default app;
