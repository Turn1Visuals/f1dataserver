import prisma from "../db/client.js";
import { startupSync } from "./startup-sync.js";

const POLL_INTERVAL_NORMAL_MS  = 24 * 60 * 60 * 1000; // 24h
const POLL_INTERVAL_ACTIVE_MS  = 30 * 60 * 1000;       // 30min
const RACE_WINDOW_AFTER_MS     = 48 * 60 * 60 * 1000;  // 48h after race

let timer: NodeJS.Timeout | null = null;

async function getLastRaceSession(): Promise<{ dateStart: Date; hasResults: boolean } | null> {
  const now = new Date();

  const session = await prisma.session.findFirst({
    where: {
      type: "RACE",
      dateStart: { lte: now },
      event: { seasonYear: now.getFullYear() },
    },
    orderBy: { dateStart: "desc" },
    select: {
      dateStart: true,
      _count: { select: { results: true } },
    },
  });

  if (!session) return null;
  return {
    dateStart: session.dateStart!,
    hasResults: session._count.results > 0,
  };
}

async function isInActiveWindow(): Promise<boolean> {
  const last = await getLastRaceSession();
  if (!last) return false;

  const msSinceRace = Date.now() - last.dateStart.getTime();
  return msSinceRace >= 0 && msSinceRace <= RACE_WINDOW_AFTER_MS;
}

async function hasNewDataAvailable(): Promise<boolean> {
  const last = await getLastRaceSession();
  if (!last) return false;
  return !last.hasResults;
}

async function tick() {
  if (timer) clearTimeout(timer);

  const active = await isInActiveWindow();

  if (active) {
    const needsSync = await hasNewDataAvailable();
    if (needsSync) {
      console.log("[scheduler] Race data not yet available — syncing...");
      await startupSync();
    } else {
      console.log("[scheduler] In active race window, data is current");
    }
    timer = setTimeout(tick, POLL_INTERVAL_ACTIVE_MS);
    console.log(`[scheduler] Next check in 30 minutes`);
  } else {
    console.log("[scheduler] No active race window — next check in 24h");
    timer = setTimeout(tick, POLL_INTERVAL_NORMAL_MS);
  }
}

export function startScheduler() {
  console.log("[scheduler] Starting...");
  tick(); // run immediately on start
}

export function stopScheduler() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
