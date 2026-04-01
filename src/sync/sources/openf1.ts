import axios from "axios";

const BASE = "https://api.openf1.org/v1";

async function get<T>(path: string, params: Record<string, string | number> = {}): Promise<T[]> {
  let attempts = 0;
  while (true) {
    try {
      await new Promise((r) => setTimeout(r, 400)); // stay under 3 req/s
      const res = await axios.get<T[]>(`${BASE}${path}`, { params });
      return res.data;
    } catch (err: any) {
      if (err?.response?.status === 404) return [];
      if (err?.response?.status === 429 && attempts < 5) {
        attempts++;
        const retryAfter = Number(err.response.headers["retry-after"] ?? 2);
        console.warn(`  Rate limited, retrying in ${retryAfter + 1}s...`);
        await new Promise((r) => setTimeout(r, (retryAfter + 1) * 1000));
      } else {
        throw err;
      }
    }
  }
}

export async function fetchOpenF1Drivers(year: number): Promise<OpenF1DriverRaw[]> {
  // Drivers are session-scoped in OpenF1 — fetch unique drivers per year via meetings
  const meetings = await fetchOpenF1Meetings(year);
  const driverMap = new Map<number, OpenF1DriverRaw>();

  for (const meeting of meetings) {
    const drivers = await get<OpenF1DriverRaw>("/drivers", {
      meeting_key: meeting.meeting_key,
    });
    for (const d of drivers) {
      // Keep the latest record per driver number
      driverMap.set(d.driver_number, d);
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  return Array.from(driverMap.values());
}

export async function fetchOpenF1Meetings(year: number): Promise<OpenF1MeetingRaw[]> {
  return get<OpenF1MeetingRaw>("/meetings", { year });
}

export async function fetchOpenF1Sessions(year: number): Promise<OpenF1SessionRaw[]> {
  return get<OpenF1SessionRaw>("/sessions", { year });
}

// ─── Raw types ────────────────────────────────────────────────────────────────

export interface OpenF1DriverRaw {
  driver_number: number;
  broadcast_name: string;
  full_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string;
  first_name: string;
  last_name: string;
  headshot_url: string | null;
  country_code: string | null;
  session_key: number;
  meeting_key: number;
}

export interface OpenF1MeetingRaw {
  meeting_key: number;
  meeting_name: string;
  meeting_official_name: string;
  location: string;
  country_key: number;
  country_code: string;
  country_name: string;
  circuit_key: number;
  circuit_short_name: string;
  circuit_type: string;
  gmt_offset: string;
  date_start: string;
  date_end: string;
  year: number;
}

export interface OpenF1SessionRaw {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  meeting_key: number;
  circuit_key: number;
  circuit_short_name: string;
  country_key: number;
  country_code: string;
  country_name: string;
  location: string;
  gmt_offset: string;
  year: number;
}
