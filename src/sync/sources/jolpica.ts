import axios from "axios";

const BASE = "https://api.jolpi.ca/ergast/f1";
const LIMIT = 100;

async function fetchAll<T>(path: string): Promise<T[]> {
  const results: T[] = [];
  let offset = 0;

  while (true) {
    const url = `${BASE}${path}.json?limit=${LIMIT}&offset=${offset}`;
    const res = await axios.get(url);
    const table = res.data.MRData;

    // Find the table object (e.g. RaceTable, DriverTable) then find the array inside it
    const dataKey = Object.keys(table).find(
      (k) => !["xmlns", "series", "url", "limit", "offset", "total"].includes(k)
    )!;
    const inner = table[dataKey] as Record<string, unknown>;
    const arrayKey = Object.keys(inner).find((k) => Array.isArray(inner[k]))!;
    const items = (inner[arrayKey] ?? []) as T[];

    results.push(...items);

    const total = Number(table.total);
    offset += LIMIT;
    if (offset >= total) break;

    // Polite delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  return results;
}

export async function fetchSeasons() {
  return fetchAll<JolpikaSeasonRaw>("/seasons");
}

export async function fetchDrivers() {
  return fetchAll<JolpikaDriverRaw>("/drivers");
}

export async function fetchConstructors() {
  return fetchAll<JolpikaConstructorRaw>("/constructors");
}

export async function fetchCircuits() {
  return fetchAll<JolpikaCircuitRaw>("/circuits");
}

export async function fetchRaces(season: number) {
  return fetchAll<JolpikaRaceRaw>(`/${season}`);
}

// Results are nested: RaceTable.Races[0].Results[]
async function fetchNestedFromRace<T>(path: string, nestedKey: string): Promise<T[]> {
  const races = await fetchAll<Record<string, unknown>>(path);
  return races.flatMap((race) => (race[nestedKey] as T[]) ?? []);
}

export async function fetchResults(season: number, round: number) {
  return fetchNestedFromRace<JolpikaResultRaw>(`/${season}/${round}/results`, "Results");
}

export async function fetchQualifying(season: number, round: number) {
  return fetchNestedFromRace<JolpikaQualifyingRaw>(`/${season}/${round}/qualifying`, "QualifyingResults");
}

export async function fetchSprintResults(season: number, round: number) {
  return fetchNestedFromRace<JolpikaResultRaw>(`/${season}/${round}/sprint`, "SprintResults");
}

export async function fetchDriverStandings(season: number, round?: number) {
  const path = round
    ? `/${season}/${round}/driverStandings`
    : `/${season}/driverStandings`;
  return fetchNestedFromRace<JolpikaStandingsListRaw>(path, "DriverStandings");
}

export async function fetchConstructorStandings(season: number, round?: number) {
  const path = round
    ? `/${season}/${round}/constructorStandings`
    : `/${season}/constructorStandings`;
  return fetchNestedFromRace<JolpikaStandingsListRaw>(path, "ConstructorStandings");
}

export async function fetchLapTimes(season: number, round: number) {
  return fetchNestedFromRace<JolpikaLapRaw>(`/${season}/${round}/laps`, "Laps");
}

export async function fetchPitStops(season: number, round: number) {
  return fetchNestedFromRace<JolpikaPitStopRaw>(`/${season}/${round}/pitstops`, "PitStops");
}

// ─── Raw types from Jolpica API ───────────────────────────────────────────────

export interface JolpikaSeasonRaw {
  season: string;
  url: string;
}

export interface JolpikaDriverRaw {
  driverId: string;
  permanentNumber?: string;
  code?: string;
  url: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string;
  nationality: string;
}

export interface JolpikaConstructorRaw {
  constructorId: string;
  url: string;
  name: string;
  nationality: string;
}

export interface JolpikaCircuitRaw {
  circuitId: string;
  url: string;
  circuitName: string;
  Location: {
    lat: string;
    long: string;
    locality: string;
    country: string;
  };
}

export interface JolpikaRaceRaw {
  season: string;
  round: string;
  url: string;
  raceName: string;
  Circuit: JolpikaCircuitRaw;
  date: string;
  time?: string;
}

export interface JolpikaResultRaw {
  number: string;
  position: string;
  positionText: string;
  points: string;
  Driver: JolpikaDriverRaw;
  Constructor: JolpikaConstructorRaw;
  grid: string;
  laps: string;
  status: string;
  Time?: { millis?: string; time: string };
  FastestLap?: {
    rank: string;
    lap: string;
    Time: { time: string };
    AverageSpeed: { units: string; speed: string };
  };
}

export interface JolpikaQualifyingRaw {
  number: string;
  position: string;
  Driver: JolpikaDriverRaw;
  Constructor: JolpikaConstructorRaw;
  Q1?: string;
  Q2?: string;
  Q3?: string;
}

export interface JolpikaStandingsListRaw {
  season: string;
  round: string;
  DriverStandings?: JolpikaDriverStandingRaw[];
  ConstructorStandings?: JolpikaConstructorStandingRaw[];
}

export interface JolpikaDriverStandingRaw {
  position: string;
  positionText: string;
  points: string;
  wins: string;
  Driver: JolpikaDriverRaw;
  Constructors: JolpikaConstructorRaw[];
}

export interface JolpikaConstructorStandingRaw {
  position: string;
  positionText: string;
  points: string;
  wins: string;
  Constructor: JolpikaConstructorRaw;
}

export interface JolpikaLapRaw {
  number: string;
  Timings: { driverId: string; position: string; time: string }[];
}

export interface JolpikaPitStopRaw {
  driverId: string;
  lap: string;
  stop: string;
  time: string;
  duration: string;
}
