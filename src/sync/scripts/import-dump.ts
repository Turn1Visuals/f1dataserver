import "dotenv/config";
import fs from "fs";
import path from "path";
import os from "os";
import https from "https";
import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import prisma from "../../db/client.js";

const DUMP_URL = "https://api.jolpi.ca/data/dumps/download/delayed/?dump_type=csv";
const EXTRACT_DIR = path.join(os.tmpdir(), "jolpica-dump");
const ZIP_PATH = path.join(os.tmpdir(), "jolpica-dump.zip");
const SOURCE = "jolpica-dump";
const BATCH = 500;

// ─── Session type mapping ─────────────────────────────────────────────────────

const SESSION_TYPE_MAP: Record<string, string> = {
  R: "RACE",
  SR: "SPRINT",
  QB: "QUALIFYING",
  QO: "QUALIFYING",
  QA: "QUALIFYING",
  Q1: "QUALIFYING",
  Q2: "QUALIFYING",
  Q3: "QUALIFYING",
  SQ1: "SPRINT_QUALIFYING",
  SQ2: "SPRINT_QUALIFYING",
  SQ3: "SPRINT_QUALIFYING",
  FP1: "PRACTICE_1",
  FP2: "PRACTICE_2",
  FP3: "PRACTICE_3",
};

// Q session codes that contribute to qualifying lap times
const Q_PART: Record<string, "q1Ms" | "q2Ms" | "q3Ms"> = {
  Q1: "q1Ms",
  SQ1: "q1Ms",
  Q2: "q2Ms",
  SQ2: "q2Ms",
  Q3: "q3Ms",
  SQ3: "q3Ms",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readCsv<T extends Record<string, string>>(filename: string): T[] {
  const file = path.join(EXTRACT_DIR, filename);
  const content = fs.readFileSync(file, "utf-8");
  return parse(content, { columns: true, skip_empty_lines: true }) as T[];
}

function timeToMs(time?: string): bigint | null {
  if (!time || time.trim() === "") return null;
  const parts = time.trim().split(":");
  if (parts.length === 2) {
    const [min, sec] = parts;
    return BigInt(Math.round((Number(min) * 60 + Number(sec)) * 1000));
  }
  if (parts.length === 3) {
    const [h, min, sec] = parts;
    return BigInt(Math.round((Number(h) * 3600 + Number(min) * 60 + Number(sec)) * 1000));
  }
  return null;
}

async function batchInsert<T>(
  label: string,
  items: T[],
  fn: (batch: T[]) => Promise<unknown>
) {
  let done = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    await fn(batch);
    done += batch.length;
    process.stdout.write(`\r  ${label}: ${done}/${items.length}`);
  }
  console.log();
}

// ─── Download & extract ───────────────────────────────────────────────────────

async function download(): Promise<void> {
  if (fs.existsSync(EXTRACT_DIR)) {
    console.log("Using cached dump...");
    return;
  }

  console.log("Downloading dump...");
  await new Promise<void>((resolve, reject) => {
    function follow(url: string) {
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          follow(res.headers.location!);
          return;
        }
        const file = fs.createWriteStream(ZIP_PATH);
        res.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
      }).on("error", reject);
    }
    follow(DUMP_URL);
  });

  console.log("Extracting...");
  fs.mkdirSync(EXTRACT_DIR, { recursive: true });
  const zip = new AdmZip(ZIP_PATH);
  zip.extractAllTo(EXTRACT_DIR, true);
  console.log("Done.\n");
}

// ─── Import steps ─────────────────────────────────────────────────────────────

async function importSeasons(idMap: Map<string, number>) {
  console.log("Importing seasons...");
  const rows = readCsv<{ id: string; year: string }>("formula_one_season.csv");

  for (const row of rows) {
    await prisma.season.upsert({
      where: { year: Number(row.year) },
      update: {},
      create: { year: Number(row.year), rounds: 0 },
    });
    idMap.set(`season:${row.id}`, Number(row.year));
  }
  console.log(`  ✓ ${rows.length} seasons`);
}

async function importDrivers(idMap: Map<string, string>) {
  console.log("Importing drivers...");
  const rows = readCsv<{
    id: string; api_id: string; abbreviation: string; forename: string;
    surname: string; date_of_birth: string; nationality: string;
    permanent_car_number: string; country_code: string;
  }>("formula_one_driver.csv");

  await batchInsert("drivers", rows, async (batch) => {
    for (const row of batch) {
      const driver = await prisma.driver.upsert({
        where: { jolpikaId: row.api_id },
        update: {
          firstName: row.forename,
          lastName: row.surname,
          code: row.abbreviation || null,
          permanentNumber: row.permanent_car_number ? Number(row.permanent_car_number) : null,
          dob: row.date_of_birth ? new Date(row.date_of_birth) : null,
          nationality: row.nationality || null,
          countryCode: row.country_code || null,
          syncedAt: new Date(),
        },
        create: {
          jolpikaId: row.api_id,
          firstName: row.forename,
          lastName: row.surname,
          code: row.abbreviation || null,
          permanentNumber: row.permanent_car_number ? Number(row.permanent_car_number) : null,
          dob: row.date_of_birth ? new Date(row.date_of_birth) : null,
          nationality: row.nationality || null,
          countryCode: row.country_code || null,
          source: SOURCE,
          syncedAt: new Date(),
        },
      });
      idMap.set(`driver:${row.id}`, driver.id);
    }
  });
}

async function importConstructors(idMap: Map<string, string>) {
  console.log("Importing constructors...");
  const rows = readCsv<{
    id: string; api_id: string; name: string; nationality: string;
    country_code: string; primary_color: string;
  }>("formula_one_team.csv");

  for (const row of rows) {
    const c = await prisma.constructor.upsert({
      where: { jolpikaId: row.api_id },
      update: {
        name: row.name,
        nationality: row.nationality || null,
        teamColour: row.primary_color ? `#${row.primary_color}` : null,
        syncedAt: new Date(),
      },
      create: {
        jolpikaId: row.api_id,
        name: row.name,
        nationality: row.nationality || null,
        teamColour: row.primary_color ? `#${row.primary_color}` : null,
        source: SOURCE,
        syncedAt: new Date(),
      },
    });
    idMap.set(`constructor:${row.id}`, c.id);
  }
  console.log(`  ✓ ${rows.length} constructors`);
}

async function importCircuits(idMap: Map<string, string>) {
  console.log("Importing circuits...");
  const rows = readCsv<{
    id: string; api_id: string; name: string; locality: string;
    country: string; country_code: string; latitude: string; longitude: string;
  }>("formula_one_circuit.csv");

  for (const row of rows) {
    const c = await prisma.circuit.upsert({
      where: { jolpikaId: row.api_id },
      update: {
        name: row.name,
        locality: row.locality || null,
        country: row.country || null,
        lat: row.latitude ? Number(row.latitude) : null,
        lng: row.longitude ? Number(row.longitude) : null,
        syncedAt: new Date(),
      },
      create: {
        jolpikaId: row.api_id,
        name: row.name,
        locality: row.locality || null,
        country: row.country || null,
        lat: row.latitude ? Number(row.latitude) : null,
        lng: row.longitude ? Number(row.longitude) : null,
        source: SOURCE,
        syncedAt: new Date(),
      },
    });
    idMap.set(`circuit:${row.id}`, c.id);
  }
  console.log(`  ✓ ${rows.length} circuits`);
}

async function importEvents(
  idMap: Map<string, string>,
  seasonIdMap: Map<string, number>,
  circuitIdMap: Map<string, string>
) {
  console.log("Importing events...");
  const rows = readCsv<{
    id: string; api_id: string; circuit_id: string; date: string;
    name: string; number: string; race_number: string; season_id: string; is_cancelled: string;
  }>("formula_one_round.csv");

  let count = 0;
  for (const row of rows) {
    if (row.is_cancelled === "t") continue;
    const seasonYear = seasonIdMap.get(`season:${row.season_id}`);
    const circuitId = circuitIdMap.get(`circuit:${row.circuit_id}`);
    if (!seasonYear || !circuitId) continue;

    const event = await prisma.event.upsert({
      where: { seasonYear_round: { seasonYear, round: Number(row.number) } },
      update: {
        jolpikaName: row.name,
        circuitId,
        date: new Date(row.date),
        syncedAt: new Date(),
      },
      create: {
        seasonYear,
        round: Number(row.number),
        jolpikaName: row.name,
        circuitId,
        date: new Date(row.date),
        source: SOURCE,
        syncedAt: new Date(),
      },
    });

    idMap.set(`round:${row.id}`, event.id);
    count++;
  }

  // Update season round counts
  const seasonRoundCounts = new Map<number, number>();
  for (const row of rows) {
    if (row.is_cancelled === "t") continue;
    const year = seasonIdMap.get(`season:${row.season_id}`);
    if (year) seasonRoundCounts.set(year, (seasonRoundCounts.get(year) ?? 0) + 1);
  }
  for (const [year, rounds] of seasonRoundCounts) {
    await prisma.season.update({ where: { year }, data: { rounds } });
  }

  console.log(`  ✓ ${count} events`);
}

async function importSessions(
  idMap: Map<string, string>,
  eventIdMap: Map<string, string>
) {
  console.log("Importing sessions...");
  const rows = readCsv<{
    id: string; api_id: string; round_id: string; type: string;
    timestamp: string; is_cancelled: string;
  }>("formula_one_session.csv");

  // For Q1/Q2/Q3, we create one QUALIFYING session per round (not three)
  const qualifyingSessionPerRound = new Map<string, string>(); // round_id → our session id
  const sprintQualifyingSessionPerRound = new Map<string, string>();

  let count = 0;
  for (const row of rows) {
    if (row.is_cancelled === "t") continue;
    const eventId = eventIdMap.get(`round:${row.round_id}`);
    if (!eventId) continue;

    const type = SESSION_TYPE_MAP[row.type];
    if (!type) continue;

    // Q1/Q2/Q3 → one shared QUALIFYING session per round
    if (["Q1", "Q2", "Q3", "QB", "QO", "QA"].includes(row.type)) {
      let sessionId = qualifyingSessionPerRound.get(row.round_id);
      if (!sessionId) {
        const existing = await prisma.session.findFirst({
          where: { eventId, type: "QUALIFYING" },
        });
        if (existing) {
          sessionId = existing.id;
        } else {
          const s = await prisma.session.create({
            data: {
              eventId,
              type: "QUALIFYING",
              name: "Qualifying",
              dateStart: row.timestamp ? new Date(row.timestamp) : null,
              source: SOURCE,
              syncedAt: new Date(),
            },
          });
          sessionId = s.id;
          count++;
        }
        qualifyingSessionPerRound.set(row.round_id, sessionId);
      }
      idMap.set(`session:${row.id}`, sessionId);
      continue;
    }

    // SQ1/SQ2/SQ3 → one shared SPRINT_QUALIFYING session per round
    if (["SQ1", "SQ2", "SQ3"].includes(row.type)) {
      let sessionId = sprintQualifyingSessionPerRound.get(row.round_id);
      if (!sessionId) {
        const existing = await prisma.session.findFirst({
          where: { eventId, type: "SPRINT_QUALIFYING" },
        });
        if (existing) {
          sessionId = existing.id;
        } else {
          const s = await prisma.session.create({
            data: {
              eventId,
              type: "SPRINT_QUALIFYING",
              name: "Sprint Qualifying",
              dateStart: row.timestamp ? new Date(row.timestamp) : null,
              source: SOURCE,
              syncedAt: new Date(),
            },
          });
          sessionId = s.id;
          count++;
        }
        sprintQualifyingSessionPerRound.set(row.round_id, sessionId);
      }
      idMap.set(`session:${row.id}`, sessionId);
      continue;
    }

    const existing = await prisma.session.findFirst({
      where: { eventId, type: type as any },
    });

    if (existing) {
      idMap.set(`session:${row.id}`, existing.id);
    } else {
      const s = await prisma.session.create({
        data: {
          eventId,
          type: type as any,
          name: row.type,
          dateStart: row.timestamp ? new Date(row.timestamp) : null,
          source: SOURCE,
          syncedAt: new Date(),
        },
      });
      idMap.set(`session:${row.id}`, s.id);
      count++;
    }
  }
  console.log(`  ✓ ${count} sessions`);
}

async function importDriverSeasons(
  driverIdMap: Map<string, string>,
  constructorIdMap: Map<string, string>,
  seasonIdMap: Map<string, number>,
  teamDriverIdMap: Map<string, { driverId: string; constructorId: string; seasonYear: number }>
) {
  console.log("Importing driver seasons...");
  const rows = readCsv<{
    id: string; driver_id: string; team_id: string; season_id: string;
  }>("formula_one_teamdriver.csv");

  let count = 0;
  for (const row of rows) {
    const driverId = driverIdMap.get(`driver:${row.driver_id}`);
    const constructorId = constructorIdMap.get(`constructor:${row.team_id}`);
    const seasonYear = seasonIdMap.get(`season:${row.season_id}`);
    if (!driverId || !constructorId || !seasonYear) continue;

    await prisma.driverSeason.upsert({
      where: { driverId_constructorId_seasonYear: { driverId, constructorId, seasonYear } },
      update: {},
      create: { driverId, constructorId, seasonYear },
    });

    teamDriverIdMap.set(row.id, { driverId, constructorId, seasonYear });
    count++;
  }
  console.log(`  ✓ ${count} driver seasons`);
}

async function importResults(
  sessionIdMap: Map<string, string>,
  roundEntryMap: Map<string, { driverId: string; constructorId: string; carNumber: number }>,
  dumpSessionTypeMap: Map<string, string> // dump session id → dump session type
) {
  console.log("Importing session entries (results)...");
  const rows = readCsv<{
    id: string; round_entry_id: string; session_id: string;
    position: string; points: string; grid: string; laps_completed: string;
    status: string; time: string; fastest_lap_rank: string; is_classified: string; detail: string;
  }>("formula_one_sessionentry.csv");

  const raceRows: typeof rows = [];
  const qualRows: typeof rows = [];

  for (const row of rows) {
    const dumpType = dumpSessionTypeMap.get(row.session_id);
    if (!dumpType) continue;
    if (dumpType === "R" || dumpType === "SR") raceRows.push(row);
    else if (["Q1","Q2","Q3","QB","QO","QA","SQ1","SQ2","SQ3"].includes(dumpType)) qualRows.push(row);
  }

  // Race / Sprint results
  await batchInsert("results", raceRows, async (batch) => {
    for (const row of batch) {
      const sessionId = sessionIdMap.get(`session:${row.session_id}`);
      const entry = roundEntryMap.get(row.round_entry_id);
      if (!sessionId || !entry) continue;

      await prisma.result.upsert({
        where: { sessionId_driverId: { sessionId, driverId: entry.driverId } },
        update: {
          constructorId: entry.constructorId,
          position: row.position ? Number(row.position) : null,
          positionText: row.position || row.detail || null,
          points: row.points ? Number(row.points) : null,
          grid: row.grid ? Number(row.grid) : null,
          laps: row.laps_completed ? Number(row.laps_completed) : null,
          status: row.detail || null,
          timeMs: timeToMs(row.time),
          fastestLapRank: row.fastest_lap_rank ? Number(row.fastest_lap_rank) : null,
          syncedAt: new Date(),
        },
        create: {
          sessionId,
          driverId: entry.driverId,
          constructorId: entry.constructorId,
          position: row.position ? Number(row.position) : null,
          positionText: row.position || row.detail || null,
          points: row.points ? Number(row.points) : null,
          grid: row.grid ? Number(row.grid) : null,
          laps: row.laps_completed ? Number(row.laps_completed) : null,
          status: row.detail || null,
          timeMs: timeToMs(row.time),
          fastestLapRank: row.fastest_lap_rank ? Number(row.fastest_lap_rank) : null,
          source: SOURCE,
          syncedAt: new Date(),
        },
      });
    }
  });

  // Qualifying results
  await batchInsert("qualifying results", qualRows, async (batch) => {
    for (const row of batch) {
      const sessionId = sessionIdMap.get(`session:${row.session_id}`);
      const entry = roundEntryMap.get(row.round_entry_id);
      const dumpType = dumpSessionTypeMap.get(row.session_id)!;
      if (!sessionId || !entry) continue;

      const qField = Q_PART[dumpType];
      const timeMs = timeToMs(row.time);

      const existing = await prisma.qualifyingResult.findUnique({
        where: { sessionId_driverId: { sessionId, driverId: entry.driverId } },
      });

      if (existing) {
        await prisma.qualifyingResult.update({
          where: { id: existing.id },
          data: {
            position: row.position ? Number(row.position) : existing.position,
            ...(qField && timeMs ? { [qField]: timeMs } : {}),
            syncedAt: new Date(),
          },
        });
      } else {
        await prisma.qualifyingResult.create({
          data: {
            sessionId,
            driverId: entry.driverId,
            constructorId: entry.constructorId,
            position: row.position ? Number(row.position) : null,
            ...(qField && timeMs ? { [qField]: timeMs } : {}),
            source: SOURCE,
            syncedAt: new Date(),
          },
        });
      }
    }
  });
}

async function importStandings(
  sessionIdMap: Map<string, string>,
  driverIdMap: Map<string, string>,
  constructorIdMap: Map<string, string>,
  seasonIdMap: Map<string, number>
) {
  console.log("Importing driver standings...");
  const driverRows = readCsv<{
    id: string; driver_id: string; session_id: string; season_id: string;
    points: string; position: string; win_count: string; is_eligible: string;
  }>("formula_one_driverchampionship.csv");

  await batchInsert("driver standings", driverRows, async (batch) => {
    for (const row of batch) {
      if (row.is_eligible !== "t") continue;
      const sessionId = sessionIdMap.get(`session:${row.session_id}`);
      const driverId = driverIdMap.get(`driver:${row.driver_id}`);
      const seasonYear = seasonIdMap.get(`season:${row.season_id}`);
      if (!sessionId || !driverId || !seasonYear) continue;

      // We need a constructorId — get it from the driver's season
      const ds = await prisma.driverSeason.findFirst({
        where: { driverId, seasonYear },
      });
      if (!ds) continue;

      await prisma.driverStanding.upsert({
        where: { sessionId_driverId: { sessionId, driverId } },
        update: {
          points: Number(row.points),
          position: Number(row.position),
          wins: Number(row.win_count),
          syncedAt: new Date(),
        },
        create: {
          seasonYear,
          sessionId,
          driverId,
          constructorId: ds.constructorId,
          points: Number(row.points),
          position: Number(row.position),
          wins: Number(row.win_count),
          source: SOURCE,
          syncedAt: new Date(),
        },
      });
    }
  });

  console.log("Importing constructor standings...");
  const constructorRows = readCsv<{
    id: string; team_id: string; session_id: string; season_id: string;
    points: string; position: string; win_count: string; is_eligible: string;
  }>("formula_one_teamchampionship.csv");

  await batchInsert("constructor standings", constructorRows, async (batch) => {
    for (const row of batch) {
      if (row.is_eligible !== "t") continue;
      const sessionId = sessionIdMap.get(`session:${row.session_id}`);
      const constructorId = constructorIdMap.get(`constructor:${row.team_id}`);
      const seasonYear = seasonIdMap.get(`season:${row.season_id}`);
      if (!sessionId || !constructorId || !seasonYear) continue;

      await prisma.constructorStanding.upsert({
        where: { sessionId_constructorId: { sessionId, constructorId } },
        update: {
          points: Number(row.points),
          position: Number(row.position),
          wins: Number(row.win_count),
          syncedAt: new Date(),
        },
        create: {
          seasonYear,
          sessionId,
          constructorId,
          points: Number(row.points),
          position: Number(row.position),
          wins: Number(row.win_count),
          source: SOURCE,
          syncedAt: new Date(),
        },
      });
    }
  });
}

async function importLapTimes(
  sessionEntryToDriver: Map<string, { driverId: string; sessionId: string }>
) {
  console.log("Importing lap times...");
  const rows = readCsv<{
    id: string; session_entry_id: string; number: string; time: string; is_deleted: string;
  }>("formula_one_lap.csv");

  const valid = rows.filter((r) => r.is_deleted !== "t" && r.time && r.number);

  await batchInsert("laps", valid, async (batch) => {
    for (const row of batch) {
      const entry = sessionEntryToDriver.get(row.session_entry_id);
      if (!entry) continue;
      const timeMs = timeToMs(row.time);
      if (!timeMs) continue;

      await prisma.lapTime.upsert({
        where: {
          sessionId_driverId_lap: {
            sessionId: entry.sessionId,
            driverId: entry.driverId,
            lap: Number(row.number),
          },
        },
        update: { timeMs, syncedAt: new Date() },
        create: {
          sessionId: entry.sessionId,
          driverId: entry.driverId,
          lap: Number(row.number),
          timeMs,
          source: SOURCE,
          syncedAt: new Date(),
        },
      });
    }
  });
}

async function importPitStops(
  sessionEntryToDriver: Map<string, { driverId: string; sessionId: string }>,
  lapIdToNumber: Map<string, number>
) {
  console.log("Importing pit stops...");
  const rows = readCsv<{
    id: string; session_entry_id: string; lap_id: string;
    number: string; duration: string;
  }>("formula_one_pitstop.csv");

  await batchInsert("pit stops", rows, async (batch) => {
    for (const row of batch) {
      const entry = sessionEntryToDriver.get(row.session_entry_id);
      if (!entry) continue;
      const lap = lapIdToNumber.get(row.lap_id);
      if (!lap) continue;
      const durationMs = timeToMs(row.duration);
      if (!durationMs) continue;

      await prisma.pitStop.upsert({
        where: {
          sessionId_driverId_stopNumber: {
            sessionId: entry.sessionId,
            driverId: entry.driverId,
            stopNumber: Number(row.number),
          },
        },
        update: { lap, durationMs, syncedAt: new Date() },
        create: {
          sessionId: entry.sessionId,
          driverId: entry.driverId,
          stopNumber: Number(row.number),
          lap,
          durationMs,
          source: SOURCE,
          syncedAt: new Date(),
        },
      });
    }
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await download();

  // ID maps — dump internal IDs → our DB IDs
  const seasonIdMap = new Map<string, number>();        // "season:N" → year
  const driverIdMap = new Map<string, string>();        // "driver:N" → cuid
  const constructorIdMap = new Map<string, string>();   // "constructor:N" → cuid
  const circuitIdMap = new Map<string, string>();       // "circuit:N" → cuid
  const eventIdMap = new Map<string, string>();         // "round:N" → cuid
  const sessionIdMap = new Map<string, string>();       // "session:N" → cuid
  const teamDriverIdMap = new Map<string, { driverId: string; constructorId: string; seasonYear: number }>();

  console.log("\n=== Importing reference data ===\n");
  await importSeasons(seasonIdMap);
  await importDrivers(driverIdMap);
  await importConstructors(constructorIdMap);
  await importCircuits(circuitIdMap);
  await importEvents(eventIdMap, seasonIdMap, circuitIdMap);
  await importSessions(sessionIdMap, eventIdMap);
  await importDriverSeasons(driverIdMap, constructorIdMap, seasonIdMap, teamDriverIdMap);

  console.log("\n=== Building lookup maps ===\n");

  // Round entries: roundentry_id → { driverId, constructorId, carNumber }
  console.log("Loading round entries...");
  const roundEntryRows = readCsv<{
    id: string; round_id: string; team_driver_id: string; car_number: string;
  }>("formula_one_roundentry.csv");

  const roundEntryMap = new Map<string, { driverId: string; constructorId: string; carNumber: number }>();
  for (const row of roundEntryRows) {
    const td = teamDriverIdMap.get(row.team_driver_id);
    if (td) roundEntryMap.set(row.id, { ...td, carNumber: Number(row.car_number) });
  }
  console.log(`  ✓ ${roundEntryMap.size} round entries`);

  // Dump session type map: dump session id → type code
  const dumpSessionRows = readCsv<{ id: string; type: string; round_id: string }>("formula_one_session.csv");
  const dumpSessionTypeMap = new Map<string, string>();
  for (const row of dumpSessionRows) dumpSessionTypeMap.set(row.id, row.type);

  // Session entry → driver/session mapping (for laps + pit stops)
  console.log("Loading session entries index...");
  const sessionEntryRows = readCsv<{ id: string; round_entry_id: string; session_id: string }>("formula_one_sessionentry.csv");
  const sessionEntryToDriver = new Map<string, { driverId: string; sessionId: string }>();
  for (const row of sessionEntryRows) {
    const entry = roundEntryMap.get(row.round_entry_id);
    const sessionId = sessionIdMap.get(`session:${row.session_id}`);
    if (entry && sessionId) sessionEntryToDriver.set(row.id, { driverId: entry.driverId, sessionId });
  }
  console.log(`  ✓ ${sessionEntryToDriver.size} session entries indexed`);

  // Lap ID → lap number map (for pit stops)
  console.log("Loading lap index...");
  const lapRows = readCsv<{ id: string; number: string; is_deleted: string }>("formula_one_lap.csv");
  const lapIdToNumber = new Map<string, number>();
  for (const row of lapRows) {
    if (row.is_deleted !== "t" && row.number) lapIdToNumber.set(row.id, Number(row.number));
  }
  console.log(`  ✓ ${lapIdToNumber.size} laps indexed`);

  console.log("\n=== Importing results & standings ===\n");
  await importResults(sessionIdMap, roundEntryMap, dumpSessionTypeMap);
  await importStandings(sessionIdMap, driverIdMap, constructorIdMap, seasonIdMap);

  console.log("\n=== Importing lap & pit data ===\n");
  await importLapTimes(sessionEntryToDriver);
  await importPitStops(sessionEntryToDriver, lapIdToNumber);

  console.log("\n=== Import complete ===\n");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
