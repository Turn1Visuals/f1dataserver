import "dotenv/config";
import prisma from "../../db/client.js";
import {
  fetchOpenF1Meetings,
  fetchOpenF1Sessions,
  fetchOpenF1Drivers,
  type OpenF1SessionRaw,
} from "../sources/openf1.js";

const SOURCE = "openf1";

const SESSION_TYPE_MAP: Record<string, string> = {
  "Practice 1": "PRACTICE_1",
  "Practice 2": "PRACTICE_2",
  "Practice 3": "PRACTICE_3",
  Qualifying: "QUALIFYING",
  "Sprint Qualifying": "SPRINT_QUALIFYING",
  "Sprint Shootout": "SPRINT_QUALIFYING",
  Sprint: "SPRINT",
  Race: "RACE",
};

async function enrichDrivers(year: number) {
  console.log(`  Enriching drivers for ${year}...`);
  const drivers = await fetchOpenF1Drivers(year);

  for (const d of drivers) {
    // Match by name_acronym (code) or permanent number
    const existing = await prisma.driver.findFirst({
      where: {
        OR: [
          { code: d.name_acronym },
          { permanentNumber: d.driver_number },
        ],
      },
    });

    if (existing) {
      await prisma.driver.update({
        where: { id: existing.id },
        data: {
          headshotUrl: d.headshot_url ?? existing.headshotUrl,
          countryCode: d.country_code ?? existing.countryCode,
          syncedAt: new Date(),
        },
      });
    }

    // Enrich constructor team colour
    const constructor = await prisma.constructor.findFirst({
      where: {
        driverSeasons: {
          some: {
            seasonYear: year,
            driver: {
              OR: [
                { code: d.name_acronym },
                { permanentNumber: d.driver_number },
              ],
            },
          },
        },
      },
    });

    if (constructor && d.team_colour) {
      await prisma.constructor.update({
        where: { id: constructor.id },
        data: { teamColour: `#${d.team_colour}`, syncedAt: new Date() },
      });
    }
  }

  console.log(`    ✓ ${drivers.length} drivers enriched`);
}

async function enrichMeetings(year: number) {
  console.log(`  Enriching meetings for ${year}...`);
  const meetings = await fetchOpenF1Meetings(year);

  for (const m of meetings) {
    // Match event by season + circuit short name or date
    const event = await prisma.event.findFirst({
      where: {
        seasonYear: year,
        date: {
          gte: new Date(new Date(m.date_start).setDate(new Date(m.date_start).getDate() - 1)),
          lte: new Date(new Date(m.date_start).setDate(new Date(m.date_start).getDate() + 5)),
        },
      },
    });

    if (event) {
      await prisma.event.update({
        where: { id: event.id },
        data: {
          openf1MeetingKey: m.meeting_key,
          officialName: m.meeting_official_name,
          location: m.location,
          country: m.country_name,
          countryCode: m.country_code,
          gmtOffset: m.gmt_offset,
          syncedAt: new Date(),
        },
      });

      // Enrich circuit
      await prisma.circuit.updateMany({
        where: { id: event.circuitId },
        data: {
          openf1CircuitKey: m.circuit_key,
          circuitType: m.circuit_type,
          syncedAt: new Date(),
        },
      });
    }
  }

  console.log(`    ✓ ${meetings.length} meetings enriched`);
}

async function enrichSessions(year: number) {
  console.log(`  Enriching sessions for ${year}...`);
  const sessions = await fetchOpenF1Sessions(year);

  for (const s of sessions) {
    const sessionType = SESSION_TYPE_MAP[s.session_name] ?? SESSION_TYPE_MAP[s.session_type];
    if (!sessionType) continue;

    // Find the event by meeting key or date proximity
    const event = await prisma.event.findFirst({
      where: {
        OR: [
          { openf1MeetingKey: s.meeting_key },
          {
            seasonYear: year,
            date: {
              gte: new Date(new Date(s.date_start).setDate(new Date(s.date_start).getDate() - 3)),
              lte: new Date(new Date(s.date_start).setDate(new Date(s.date_start).getDate() + 3)),
            },
          },
        ],
      },
    });

    if (!event) continue;

    const existing = await prisma.session.findFirst({
      where: { eventId: event.id, type: sessionType as OpenF1SessionRaw["session_type"] },
    });

    if (existing) {
      await prisma.session.update({
        where: { id: existing.id },
        data: {
          openf1SessionKey: s.session_key,
          name: s.session_name,
          dateStart: new Date(s.date_start),
          dateEnd: new Date(s.date_end),
          syncedAt: new Date(),
        },
      });
    } else {
      await prisma.session.create({
        data: {
          eventId: event.id,
          openf1SessionKey: s.session_key,
          type: sessionType as any,
          name: s.session_name,
          dateStart: new Date(s.date_start),
          dateEnd: new Date(s.date_end),
          source: SOURCE,
          syncedAt: new Date(),
        },
      });
    }
  }

  console.log(`    ✓ ${sessions.length} sessions enriched`);
}

async function main() {
  const args = process.argv.slice(2);
  const fromYear = args[0] ? Number(args[0]) : 2023;
  const toYear = args[1] ? Number(args[1]) : new Date().getFullYear();

  console.log(`\nOpenF1 enrichment sync: ${fromYear}–${toYear}\n`);

  for (let year = fromYear; year <= toYear; year++) {
    console.log(`\nYear ${year}:`);
    await enrichMeetings(year);
    await enrichSessions(year);
    await enrichDrivers(year);
  }

  console.log("\nOpenF1 enrichment complete.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
