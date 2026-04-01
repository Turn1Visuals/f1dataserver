import "dotenv/config";
import prisma from "../../db/client.js";
import {
  fetchSeasons,
  fetchDrivers,
  fetchConstructors,
  fetchCircuits,
  fetchRaces,
  fetchResults,
  fetchQualifying,
  fetchSprintResults,
  fetchDriverStandings,
  fetchConstructorStandings,
  fetchLapTimes,
  fetchPitStops,
  type JolpikaResultRaw,
  type JolpikaQualifyingRaw,
} from "../sources/jolpica.js";

const SOURCE = "jolpica";

function parseTimeToMs(time?: string): bigint | null {
  if (!time) return null;
  const parts = time.split(":");
  if (parts.length === 2) {
    const [min, sec] = parts;
    return BigInt(Math.round((Number(min) * 60 + Number(sec)) * 1000));
  }
  if (parts.length === 3) {
    const [h, min, sec] = parts;
    return BigInt(
      Math.round((Number(h) * 3600 + Number(min) * 60 + Number(sec)) * 1000)
    );
  }
  return null;
}

async function syncSeasons() {
  console.log("Syncing seasons...");
  const raw = await fetchSeasons();

  for (const s of raw) {
    await prisma.season.upsert({
      where: { year: Number(s.season) },
      update: {},
      create: { year: Number(s.season), rounds: 0 },
    });
  }
  console.log(`  ✓ ${raw.length} seasons`);
}

async function syncDrivers() {
  console.log("Syncing drivers...");
  const raw = await fetchDrivers();

  for (const d of raw) {
    const data = {
      firstName: d.givenName,
      lastName: d.familyName,
      code: d.code ?? null,
      permanentNumber: d.permanentNumber ? Number(d.permanentNumber) : null,
      dob: d.dateOfBirth ? new Date(d.dateOfBirth) : null,
      nationality: d.nationality,
      syncedAt: new Date(),
    };

    const existing = await prisma.driver.findUnique({ where: { jolpikaId: d.driverId } });
    if (existing) {
      await prisma.driver.update({ where: { id: existing.id }, data });
    } else {
      // Slug ID not found — check for name match from dump (driver_XXXXX IDs)
      const byName = await prisma.driver.findFirst({
        where: { firstName: d.givenName, lastName: d.familyName },
      });
      if (byName) {
        await prisma.driver.update({ where: { id: byName.id }, data: { ...data, jolpikaId: d.driverId } });
      } else {
        await prisma.driver.create({ data: { ...data, jolpikaId: d.driverId, source: SOURCE } });
      }
    }
  }
  console.log(`  ✓ ${raw.length} drivers`);
}

async function syncConstructors() {
  console.log("Syncing constructors...");
  const raw = await fetchConstructors();

  for (const c of raw) {
    const existing = await prisma.constructor.findUnique({ where: { jolpikaId: c.constructorId } });
    if (existing) {
      await prisma.constructor.update({
        where: { id: existing.id },
        data: { name: c.name, nationality: c.nationality, syncedAt: new Date() },
      });
    } else {
      // Slug ID not found — check for a name match from the dump (team_XXXXX IDs)
      const byName = await prisma.constructor.findFirst({ where: { name: c.name } });
      if (byName) {
        // Adopt the slug as the canonical jolpikaId so future syncs find it directly
        await prisma.constructor.update({
          where: { id: byName.id },
          data: { jolpikaId: c.constructorId, name: c.name, nationality: c.nationality, syncedAt: new Date() },
        });
      } else {
        await prisma.constructor.create({
          data: { jolpikaId: c.constructorId, name: c.name, nationality: c.nationality, source: SOURCE, syncedAt: new Date() },
        });
      }
    }
  }
  console.log(`  ✓ ${raw.length} constructors`);
}

async function syncCircuits() {
  console.log("Syncing circuits...");
  const raw = await fetchCircuits();

  for (const c of raw) {
    await prisma.circuit.upsert({
      where: { jolpikaId: c.circuitId },
      update: {
        name: c.circuitName,
        locality: c.Location.locality,
        country: c.Location.country,
        lat: Number(c.Location.lat),
        lng: Number(c.Location.long),
        syncedAt: new Date(),
      },
      create: {
        jolpikaId: c.circuitId,
        name: c.circuitName,
        locality: c.Location.locality,
        country: c.Location.country,
        lat: Number(c.Location.lat),
        lng: Number(c.Location.long),
        source: SOURCE,
        syncedAt: new Date(),
      },
    });
  }
  console.log(`  ✓ ${raw.length} circuits`);
}

async function syncSeason(year: number) {
  console.log(`\nSyncing season ${year}...`);
  const races = await fetchRaces(year);

  // Update season round count
  await prisma.season.update({
    where: { year },
    data: { rounds: races.length },
  });

  for (const race of races) {
    const circuit = await prisma.circuit.findUnique({
      where: { jolpikaId: race.Circuit.circuitId },
    });
    if (!circuit) {
      console.warn(`  Circuit not found: ${race.Circuit.circuitId}`);
      continue;
    }

    const event = await prisma.event.upsert({
      where: { seasonYear_round: { seasonYear: year, round: Number(race.round) } },
      update: {
        jolpikaName: race.raceName,
        circuitId: circuit.id,
        date: new Date(race.date),
        syncedAt: new Date(),
      },
      create: {
        seasonYear: year,
        round: Number(race.round),
        jolpikaName: race.raceName,
        circuitId: circuit.id,
        date: new Date(race.date),
        source: SOURCE,
        syncedAt: new Date(),
      },
    });

    // Ensure Race session exists
    const raceSession = await prisma.session.upsert({
      where: {
        id:
          (
            await prisma.session.findFirst({
              where: { eventId: event.id, type: "RACE" },
            })
          )?.id ?? "new",
      },
      update: { syncedAt: new Date() },
      create: {
        eventId: event.id,
        type: "RACE",
        name: "Race",
        dateStart: new Date(race.date),
        source: SOURCE,
        syncedAt: new Date(),
      },
    });

    await syncRaceResults(year, Number(race.round), raceSession.id);
    await syncQualifyingResults(year, Number(race.round), event.id);
    await syncSprintResults(year, Number(race.round), event.id);
    await syncStandings(year, Number(race.round), raceSession.id);
    await syncLapTimes(year, Number(race.round), raceSession.id);
    await syncPitStops(year, Number(race.round), raceSession.id);
  }

  console.log(`  ✓ season ${year} done`);
}

async function syncRaceResults(year: number, round: number, sessionId: string) {
  let raw: JolpikaResultRaw[];
  try {
    raw = await fetchResults(year, round);
  } catch {
    return;
  }

  for (const r of raw) {
    const driver = await prisma.driver.findUnique({ where: { jolpikaId: r.Driver.driverId } });
    const constructor = await prisma.constructor.findUnique({ where: { jolpikaId: r.Constructor.constructorId } });
    if (!driver || !constructor) continue;

    await ensureDriverSeason(driver.id, constructor.id, year, Number(r.number));

    const fastestLapTimeMs = r.FastestLap?.Time?.time
      ? parseTimeToMs(r.FastestLap.Time.time)
      : null;

    await prisma.result.upsert({
      where: { sessionId_driverId: { sessionId, driverId: driver.id } },
      update: {
        constructorId: constructor.id,
        position: Number(r.position) || null,
        positionText: r.positionText,
        points: Number(r.points),
        grid: Number(r.grid),
        laps: Number(r.laps),
        status: r.status,
        timeMs: r.Time?.millis ? BigInt(r.Time.millis) : null,
        fastestLapRank: r.FastestLap?.rank ? Number(r.FastestLap.rank) : null,
        fastestLapLap: r.FastestLap?.lap ? Number(r.FastestLap.lap) : null,
        fastestLapTimeMs,
        fastestLapSpeedKph: r.FastestLap?.AverageSpeed?.speed
          ? Number(r.FastestLap.AverageSpeed.speed)
          : null,
        syncedAt: new Date(),
      },
      create: {
        sessionId,
        driverId: driver.id,
        constructorId: constructor.id,
        position: Number(r.position) || null,
        positionText: r.positionText,
        points: Number(r.points),
        grid: Number(r.grid),
        laps: Number(r.laps),
        status: r.status,
        timeMs: r.Time?.millis ? BigInt(r.Time.millis) : null,
        fastestLapRank: r.FastestLap?.rank ? Number(r.FastestLap.rank) : null,
        fastestLapLap: r.FastestLap?.lap ? Number(r.FastestLap.lap) : null,
        fastestLapTimeMs,
        fastestLapSpeedKph: r.FastestLap?.AverageSpeed?.speed
          ? Number(r.FastestLap.AverageSpeed.speed)
          : null,
        source: SOURCE,
        syncedAt: new Date(),
      },
    });
  }
}

async function syncQualifyingResults(year: number, round: number, eventId: string) {
  let raw: JolpikaQualifyingRaw[];
  try {
    raw = await fetchQualifying(year, round);
  } catch {
    return;
  }
  if (!raw.length) return;

  const session = await prisma.session.upsert({
    where: {
      id:
        (
          await prisma.session.findFirst({
            where: { eventId, type: "QUALIFYING" },
          })
        )?.id ?? "new",
    },
    update: { syncedAt: new Date() },
    create: {
      eventId,
      type: "QUALIFYING",
      name: "Qualifying",
      source: SOURCE,
      syncedAt: new Date(),
    },
  });

  await upsertQualifyingRows(raw, session.id, year);
}

async function syncSprintResults(year: number, round: number, eventId: string) {
  let raw: JolpikaResultRaw[];
  try {
    raw = await fetchSprintResults(year, round);
  } catch {
    return;
  }
  if (!raw.length) return;

  const session = await prisma.session.upsert({
    where: {
      id:
        (
          await prisma.session.findFirst({
            where: { eventId, type: "SPRINT" },
          })
        )?.id ?? "new",
    },
    update: { syncedAt: new Date() },
    create: {
      eventId,
      type: "SPRINT",
      name: "Sprint",
      source: SOURCE,
      syncedAt: new Date(),
    },
  });

  for (const r of raw) {
    const driver = await prisma.driver.findUnique({ where: { jolpikaId: r.Driver.driverId } });
    const constructor = await prisma.constructor.findUnique({ where: { jolpikaId: r.Constructor.constructorId } });
    if (!driver || !constructor) continue;

    await prisma.result.upsert({
      where: { sessionId_driverId: { sessionId: session.id, driverId: driver.id } },
      update: {
        constructorId: constructor.id,
        position: Number(r.position) || null,
        positionText: r.positionText,
        points: Number(r.points),
        grid: Number(r.grid),
        laps: Number(r.laps),
        status: r.status,
        timeMs: r.Time?.millis ? BigInt(r.Time.millis) : null,
        syncedAt: new Date(),
      },
      create: {
        sessionId: session.id,
        driverId: driver.id,
        constructorId: constructor.id,
        position: Number(r.position) || null,
        positionText: r.positionText,
        points: Number(r.points),
        grid: Number(r.grid),
        laps: Number(r.laps),
        status: r.status,
        timeMs: r.Time?.millis ? BigInt(r.Time.millis) : null,
        source: SOURCE,
        syncedAt: new Date(),
      },
    });
  }
}

async function upsertQualifyingRows(
  raw: JolpikaQualifyingRaw[],
  sessionId: string,
  year: number
) {
  for (const r of raw) {
    const driver = await prisma.driver.findUnique({ where: { jolpikaId: r.Driver.driverId } });
    const constructor = await prisma.constructor.findUnique({ where: { jolpikaId: r.Constructor.constructorId } });
    if (!driver || !constructor) continue;

    await ensureDriverSeason(driver.id, constructor.id, year, Number(r.number));

    await prisma.qualifyingResult.upsert({
      where: { sessionId_driverId: { sessionId, driverId: driver.id } },
      update: {
        constructorId: constructor.id,
        position: Number(r.position),
        q1Ms: parseTimeToMs(r.Q1),
        q2Ms: parseTimeToMs(r.Q2),
        q3Ms: parseTimeToMs(r.Q3),
        syncedAt: new Date(),
      },
      create: {
        sessionId,
        driverId: driver.id,
        constructorId: constructor.id,
        position: Number(r.position),
        q1Ms: parseTimeToMs(r.Q1),
        q2Ms: parseTimeToMs(r.Q2),
        q3Ms: parseTimeToMs(r.Q3),
        source: SOURCE,
        syncedAt: new Date(),
      },
    });
  }
}

async function syncStandings(year: number, round: number, sessionId: string) {
  try {
    const driverStandings = await fetchDriverStandings(year, round);
    for (const s of driverStandings) {
      const driver = await prisma.driver.findUnique({ where: { jolpikaId: s.Driver.driverId } });
      const constructor = await prisma.constructor.findUnique({
        where: { jolpikaId: s.Constructors[0]?.constructorId },
      });
      const driverPosition = Number(s.position);
      if (!driver || !constructor || isNaN(driverPosition)) continue;

      await prisma.driverStanding.upsert({
        where: { sessionId_driverId: { sessionId, driverId: driver.id } },
        update: {
          constructorId: constructor.id,
          points: Number(s.points),
          position: driverPosition,
          wins: Number(s.wins),
          syncedAt: new Date(),
        },
        create: {
          seasonYear: year,
          sessionId,
          driverId: driver.id,
          constructorId: constructor.id,
          points: Number(s.points),
          position: driverPosition,
          wins: Number(s.wins),
          source: SOURCE,
          syncedAt: new Date(),
        },
      });
    }
  } catch {
    // standings may not exist for all rounds
  }

  try {
    const constructorStandings = await fetchConstructorStandings(year, round);
    for (const s of constructorStandings) {
      const constructor = await prisma.constructor.findUnique({
        where: { jolpikaId: s.Constructor.constructorId },
      });
      if (!constructor) continue;

      await prisma.constructorStanding.upsert({
        where: { sessionId_constructorId: { sessionId, constructorId: constructor.id } },
        update: {
          points: Number(s.points),
          position: Number(s.position),
          wins: Number(s.wins),
          syncedAt: new Date(),
        },
        create: {
          seasonYear: year,
          sessionId,
          constructorId: constructor.id,
          points: Number(s.points),
          position: Number(s.position),
          wins: Number(s.wins),
          source: SOURCE,
          syncedAt: new Date(),
        },
      });
    }
  } catch {
    // standings may not exist for all rounds
  }
}

async function syncLapTimes(year: number, round: number, sessionId: string) {
  let raw;
  try {
    raw = await fetchLapTimes(year, round);
  } catch {
    return;
  }

  for (const lap of raw) {
    for (const timing of lap.Timings) {
      const driver = await prisma.driver.findUnique({ where: { jolpikaId: timing.driverId } });
      if (!driver) continue;
      const timeMs = parseTimeToMs(timing.time);
      if (!timeMs) continue;

      await prisma.lapTime.upsert({
        where: { sessionId_driverId_lap: { sessionId, driverId: driver.id, lap: Number(lap.number) } },
        update: { timeMs, syncedAt: new Date() },
        create: {
          sessionId,
          driverId: driver.id,
          lap: Number(lap.number),
          timeMs,
          source: SOURCE,
          syncedAt: new Date(),
        },
      });
    }
  }
}

async function syncPitStops(year: number, round: number, sessionId: string) {
  let raw;
  try {
    raw = await fetchPitStops(year, round);
  } catch {
    return;
  }

  for (const p of raw) {
    const driver = await prisma.driver.findUnique({ where: { jolpikaId: p.driverId } });
    if (!driver) continue;
    const durationMs = parseTimeToMs(p.duration);
    if (!durationMs) continue;

    await prisma.pitStop.upsert({
      where: { sessionId_driverId_stopNumber: { sessionId, driverId: driver.id, stopNumber: Number(p.stop) } },
      update: { lap: Number(p.lap), durationMs, syncedAt: new Date() },
      create: {
        sessionId,
        driverId: driver.id,
        stopNumber: Number(p.stop),
        lap: Number(p.lap),
        durationMs,
        source: SOURCE,
        syncedAt: new Date(),
      },
    });
  }
}

async function ensureDriverSeason(
  driverId: string,
  constructorId: string,
  seasonYear: number,
  driverNumber: number
) {
  await prisma.driverSeason.upsert({
    where: { driverId_constructorId_seasonYear: { driverId, constructorId, seasonYear } },
    update: { driverNumber },
    create: { driverId, constructorId, seasonYear, driverNumber },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const fromYear = args[0] ? Number(args[0]) : 1950;
  const toYear = args[1] ? Number(args[1]) : new Date().getFullYear();

  console.log(`\nJolpica full sync: ${fromYear}–${toYear}\n`);

  await syncSeasons();
  await syncDrivers();
  await syncConstructors();
  await syncCircuits();

  for (let year = fromYear; year <= toYear; year++) {
    await syncSeason(year);
  }

  console.log("\nSync complete.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
