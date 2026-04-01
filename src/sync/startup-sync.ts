import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../db/client.js";

const STALE_AFTER_HOURS = 48;
const CURRENT_YEAR = new Date().getFullYear();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TSX = path.join(__dirname, "../../node_modules/.bin/tsx");

function runScript(script: string, args: string[] = []): Promise<void> {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, "scripts", script);
    const proc = execFile(TSX, [scriptPath, ...args], { env: process.env });

    proc.stdout?.on("data", (d) => process.stdout.write(`[sync] ${d}`));
    proc.stderr?.on("data", (d) => process.stderr.write(`[sync] ${d}`));
    proc.on("close", (code) => {
      if (code !== 0) console.warn(`[sync] ${script} exited with code ${code}`);
      resolve();
    });
  });
}

async function isStale(): Promise<boolean> {
  const latest = await prisma.event.findFirst({
    where: { seasonYear: CURRENT_YEAR },
    orderBy: { syncedAt: "desc" },
    select: { syncedAt: true },
  });

  if (!latest?.syncedAt) return true;

  const ageHours = (Date.now() - latest.syncedAt.getTime()) / 1000 / 60 / 60;
  console.log(`[sync] Current season last synced ${ageHours.toFixed(1)}h ago`);
  return ageHours > STALE_AFTER_HOURS;
}

export async function startupSync(): Promise<void> {
  try {
    if (!(await isStale())) {
      console.log(`[sync] Data is up to date, skipping sync`);
      return;
    }

    console.log(`[sync] Data is stale — syncing ${CURRENT_YEAR} in background...`);
    const year = String(CURRENT_YEAR);
    await runScript("sync-jolpica.ts", [year, year]);
    await runScript("sync-openf1.ts", [year, year]);
    console.log(`[sync] Background sync complete`);
  } catch (err) {
    console.error("[sync] Startup sync failed:", err);
  }
}
