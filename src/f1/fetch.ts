const BASE_URL = "https://livetiming.formula1.com/static";
const HEADERS = { "User-Agent": "BestHTTP", "Accept-Encoding": "gzip, identity" };

export const TOPICS = [
  "SessionInfo",
  "SessionData",
  "SessionStatus",
  "DriverList",
  "TimingData",
  "TimingAppData",
  "TimingStats",
  "RaceControlMessages",
  "TrackStatus",
  "ExtrapolatedClock",
  "TopThree",
  "LapCount",
  "WeatherData",
  "Position.z",
  "CarData.z",
] as const;

export type Topic = (typeof TOPICS)[number];

export interface TimelineEvent {
  offset: number;
  topic: Topic;
  data: unknown;
}

export interface Meeting {
  Name: string;
  Key: string;
  Location?: string;
  Sessions?: Array<{ Name: string; Path: string }>;
}

async function fetchText(path: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  const text = await res.text();
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export async function fetchJson<T>(path: string): Promise<T> {
  const text = await fetchText(path);
  return JSON.parse(text) as T;
}

export async function fetchStream(path: string): Promise<string> {
  return fetchText(path);
}

export function parseStream(text: string): Array<{ offset: number; data: unknown }> {
  const entries: Array<{ offset: number; data: unknown }> = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d+)([\s\S]*)$/);
    if (!match) continue;
    const [, hh, mm, ss, ms, json] = match;
    const offset =
      (parseInt(hh!) * 3600 + parseInt(mm!) * 60 + parseInt(ss!)) * 1000 +
      parseInt(ms!.padEnd(3, "0").slice(0, 3));
    let data: unknown;
    try {
      data = JSON.parse(json!.trim());
    } catch {
      data = json!.trim();
    }
    entries.push({ offset, data });
  }
  return entries;
}

export async function fetchSeasonIndex(year: number): Promise<Meeting[]> {
  const index = await fetchJson<{ Meetings?: Meeting[] }>(`${year}/Index.json`);
  return index.Meetings ?? [];
}

export async function fetchTopic(
  sessionPath: string,
  topic: Topic
): Promise<Array<{ offset: number; data: unknown }>> {
  try {
    const raw = await fetchStream(`${sessionPath}${topic}.jsonStream`);
    return parseStream(raw);
  } catch (e) {
    console.warn(`  [f1/fetch] ${topic}: ${(e as Error).message}`);
    return [];
  }
}
