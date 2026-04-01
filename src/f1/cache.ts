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

// sessionPath looks like "2026/1234_BahrainGrandPrix/Race/"
function sessionDir(sessionPath: string): string {
  const clean = sessionPath.replace(/\/$/, "");
  return join(getSessionsRoot(), clean);
}

function timelinePath(sessionPath: string): string {
  return join(sessionDir(sessionPath), "timeline.ndjson");
}

export function isCached(sessionPath: string): boolean {
  return existsSync(timelinePath(sessionPath));
}

export function writeCache(sessionPath: string, timeline: TimelineEvent[]): void {
  const dir = sessionDir(sessionPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const lines = timeline.map((e) => JSON.stringify(e)).join("\n");
  writeFileSync(timelinePath(sessionPath), lines + "\n", "utf-8");
  console.log(`[f1/cache] Saved ${timeline.length} events → ${timelinePath(sessionPath)}`);
}

export function appendCache(sessionPath: string, event: TimelineEvent): void {
  const dir = sessionDir(sessionPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(timelinePath(sessionPath), JSON.stringify(event) + "\n", "utf-8");
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

  function scan(dir: string, depth: number, prefix: string): void {
    if (depth > 3) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const rel = prefix ? `${prefix}/${entry}` : entry;
      if (statSync(full).isDirectory()) {
        scan(full, depth + 1, rel);
      } else if (entry === "timeline.ndjson") {
        const sessionPath = prefix + "/";
        const year = parseInt(prefix.split("/")[0] ?? "0");
        results.push({ sessionPath, year, sizeBytes: statSync(full).size });
      }
    }
  }

  if (existsSync(root)) scan(root, 0, "");
  return results;
}
