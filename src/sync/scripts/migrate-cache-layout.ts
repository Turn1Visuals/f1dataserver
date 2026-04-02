/**
 * Migrates session cache from old layout to new flat layout.
 *
 * Old: sessions/{year}/{event}/{session}/timeline.ndjson
 * New: sessions/{year}/{event}/{session}.ndjson
 */

import { existsSync, readdirSync, statSync, renameSync, rmdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../../..", "sessions");

if (!existsSync(root)) {
  console.log("No sessions directory found, nothing to migrate.");
  process.exit(0);
}

let moved = 0;

for (const yearEntry of readdirSync(root)) {
  if (yearEntry === "circuits") continue;
  const yearDir = join(root, yearEntry);
  if (!statSync(yearDir).isDirectory()) continue;

  for (const eventEntry of readdirSync(yearDir)) {
    const eventDir = join(yearDir, eventEntry);
    if (!statSync(eventDir).isDirectory()) continue;

    for (const sessionEntry of readdirSync(eventDir)) {
      const sessionDir = join(eventDir, sessionEntry);
      if (!statSync(sessionDir).isDirectory()) continue;

      const oldFile = join(sessionDir, "timeline.ndjson");
      if (!existsSync(oldFile)) continue;

      const newFile = join(eventDir, `${sessionEntry}.ndjson`);
      renameSync(oldFile, newFile);
      console.log(`Moved: ${yearEntry}/${eventEntry}/${sessionEntry}/timeline.ndjson → ${sessionEntry}.ndjson`);
      moved++;

      // Remove now-empty session directory
      try { rmdirSync(sessionDir); } catch { /* not empty, skip */ }
    }
  }
}

console.log(`\nDone. ${moved} file(s) migrated.`);
