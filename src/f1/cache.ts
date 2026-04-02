import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { TimelineEvent } from "./fetch.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getSessionsRoot(): string {
  const base = process.env["F1_DATA_DIR"] ?? join(__dirname, "../..");
  const root = process.env.SESSIONS_DIR ?? join(base, "sessions");
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
  return root;
}

// sessionPath looks like "2026/2026-03-29_Japanese_Grand_Prix/2026-03-29_Race/"
// Stored as sessions/2026/2026-03-29_Japanese_Grand_Prix/2026-03-29_Race.ndjson
function timelinePath(sessionPath: string): string {
  const parts = sessionPath.replace(/\/$/, "").split("/");
  const sessionName = parts.pop()!;
  const eventDir = join(getSessionsRoot(), ...parts);
  return join(eventDir, `${sessionName}.ndjson`);
}

export function isCached(sessionPath: string): boolean {
  return existsSync(timelinePath(sessionPath));
}

export function writeCache(sessionPath: string, timeline: TimelineEvent[]): void {
  const file = timelinePath(sessionPath);
  mkdirSync(dirname(file), { recursive: true });
  const lines = timeline.map((e) => JSON.stringify(e)).join("\n");
  writeFileSync(file, lines + "\n", "utf-8");
  console.log(`[f1/cache] Saved ${timeline.length} events → ${file}`);
}

export function appendCache(sessionPath: string, event: TimelineEvent): void {
  const file = timelinePath(sessionPath);
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify(event) + "\n", "utf-8");
}

export function readCache(sessionPath: string): TimelineEvent[] {
  const file = timelinePath(sessionPath);
  const lines = readFileSync(file, "utf-8").split("\n").filter(Boolean);
  const timeline = lines.map((l) => JSON.parse(l) as TimelineEvent);
  console.log(`[f1/cache] Loaded ${timeline.length} events from ${file}`);
  return timeline;
}

export interface CachedSession {
  sessionPath: string;
  year: number;
  sizeBytes: number;
}

export function listCached(): CachedSession[] {
  const root = getSessionsRoot();
  const results: CachedSession[] = [];

  if (!existsSync(root)) return results;

  for (const yearEntry of readdirSync(root)) {
    if (yearEntry === "circuits") continue;
    const year = parseInt(yearEntry);
    if (isNaN(year)) continue;
    const yearDir = join(root, yearEntry);
    if (!statSync(yearDir).isDirectory()) continue;

    for (const eventEntry of readdirSync(yearDir)) {
      const eventDir = join(yearDir, eventEntry);
      if (!statSync(eventDir).isDirectory()) continue;

      for (const file of readdirSync(eventDir)) {
        if (!file.endsWith(".ndjson")) continue;
        const sessionName = file.slice(0, -7); // strip .ndjson
        const sessionPath = `${yearEntry}/${eventEntry}/${sessionName}/`;
        results.push({ sessionPath, year, sizeBytes: statSync(join(eventDir, file)).size });
      }
    }
  }

  return results;
}
