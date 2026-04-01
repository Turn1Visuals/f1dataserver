/**
 * Targeted re-sync: fetch driver + constructor standings for all 2026 rounds
 * and upsert into DB. Includes rate-limit delay between requests.
 */
import "dotenv/config";
import prisma from "../../db/client.js";
import { fetchDriverStandings, fetchConstructorStandings } from "../sources/jolpica.js";

const YEAR = 2026;
const DELAY_MS = 1500; // 1.5s between requests to avoid 429

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Find all 2026 race sessions that have a round number
const sessions = await prisma.session.findMany({
  where: { name: "Race", event: { seasonYear: YEAR } },
  select: { id: true, event: { select: { round: true } } },
  orderBy: { event: { round: "asc" } },
});

console.log(`Found ${sessions.length} race sessions for ${YEAR}`);

for (const session of sessions) {
  const round = session.event.round;
  console.log(`\nRound ${round} (session ${session.id}):`);

  // --- Driver standings ---
  try {
    await sleep(DELAY_MS);
    const driverStandings = await fetchDriverStandings(YEAR, round);
    console.log(`  Fetched ${driverStandings.length} driver standings`);
    let ok = 0, skip = 0;

    for (const s of driverStandings) {
      const driver = await prisma.driver.findUnique({ where: { jolpikaId: s.Driver.driverId } });
      const constructor = await prisma.constructor.findUnique({
        where: { jolpikaId: s.Constructors[0]?.constructorId },
      });
      if (!driver || !constructor) {
        console.log(`    skip driver ${s.Driver.driverId} (driver=${!!driver} constructor=${!!constructor})`);
        skip++;
        continue;
      }

      const position = Number(s.position);
      if (isNaN(position)) {
        console.log(`    skip ${s.Driver.driverId}: position is NaN (raw: ${s.position})`);
        skip++;
        continue;
      }

      await prisma.driverStanding.upsert({
        where: { sessionId_driverId: { sessionId: session.id, driverId: driver.id } },
        update: {
          constructorId: constructor.id,
          points: Number(s.points),
          position,
          wins: Number(s.wins),
          syncedAt: new Date(),
        },
        create: {
          seasonYear: YEAR,
          sessionId: session.id,
          driverId: driver.id,
          constructorId: constructor.id,
          points: Number(s.points),
          position,
          wins: Number(s.wins),
          source: "jolpica",
          syncedAt: new Date(),
        },
      });
      ok++;
    }
    console.log(`  Driver standings: ${ok} upserted, ${skip} skipped`);
  } catch (e: any) {
    console.log(`  Driver standings error: ${e.message}`);
  }

  // --- Constructor standings ---
  try {
    await sleep(DELAY_MS);
    const constructorStandings = await fetchConstructorStandings(YEAR, round);
    console.log(`  Fetched ${constructorStandings.length} constructor standings`);
    let ok = 0, skip = 0;

    for (const s of constructorStandings) {
      const constructor = await prisma.constructor.findUnique({
        where: { jolpikaId: s.Constructor.constructorId },
      });
      if (!constructor) {
        console.log(`    skip constructor ${s.Constructor.constructorId}`);
        skip++;
        continue;
      }

      await prisma.constructorStanding.upsert({
        where: { sessionId_constructorId: { sessionId: session.id, constructorId: constructor.id } },
        update: {
          points: Number(s.points),
          position: Number(s.position),
          wins: Number(s.wins),
          syncedAt: new Date(),
        },
        create: {
          seasonYear: YEAR,
          sessionId: session.id,
          constructorId: constructor.id,
          points: Number(s.points),
          position: Number(s.position),
          wins: Number(s.wins),
          source: "jolpica",
          syncedAt: new Date(),
        },
      });
      ok++;
    }
    console.log(`  Constructor standings: ${ok} upserted, ${skip} skipped`);
  } catch (e: any) {
    console.log(`  Constructor standings error: ${e.message}`);
  }
}

console.log("\nDone.");
await prisma.$disconnect();
