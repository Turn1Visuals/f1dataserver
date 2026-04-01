import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MV_API     = "https://api.multiviewer.app/api/v2/circuits";
const MV_HEADERS = { "x-mv-api-terms-accepted": "true" };
const TTL_MS     = 6 * 60 * 60 * 1000; // 6 hours

function getCacheDir(): string {
  const dir = join(__dirname, "../../sessions/circuits");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cachePath(circuitKey: string | number, season: string | number): string {
  return join(getCacheDir(), `${circuitKey}_${season}.json`);
}

function isFresh(file: string): boolean {
  try { return Date.now() - statSync(file).mtimeMs < TTL_MS; } catch { return false; }
}

export async function getCircuitLayout(
  circuitKey: string | number,
  season: string | number
): Promise<unknown> {
  const file   = cachePath(circuitKey, season);
  const cached = existsSync(file);

  if (cached && isFresh(file)) {
    console.log(`[f1/circuits] Loaded from cache: ${circuitKey}/${season}`);
    return JSON.parse(readFileSync(file, "utf-8")) as unknown;
  }

  console.log(`[f1/circuits] Fetching from MultiViewer: ${circuitKey}/${season}`);
  let data: unknown = null;
  try {
    const url = `${MV_API}/${encodeURIComponent(String(circuitKey))}/${encodeURIComponent(String(season))}`;
    const res = await fetch(url, {
      headers: MV_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    if (cached) {
      console.log(`[f1/circuits] Fetch failed — using stale cache for ${circuitKey}/${season}`);
      return JSON.parse(readFileSync(file, "utf-8")) as unknown;
    }
    throw new Error(`Circuit layout unavailable (key=${circuitKey} season=${season}): ${(err as Error).message}`);
  }

  writeFileSync(file, JSON.stringify(data), "utf-8");
  console.log(`[f1/circuits] Cached: ${circuitKey}/${season}`);
  return data;
}
