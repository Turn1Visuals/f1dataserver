import { Router } from "express";

const router = Router();

const mermaidDiagram = `
erDiagram
  Season {
    int year PK
    int rounds
  }

  Driver {
    string id PK
    string jolpikaId
    string firstName
    string lastName
    string code
    int permanentNumber
    date dob
    string nationality
    string headshotUrl
    string countryCode
    string source
  }

  Constructor {
    string id PK
    string jolpikaId
    string name
    string nationality
    string teamColour
    string source
  }

  Circuit {
    string id PK
    string jolpikaId
    int openf1CircuitKey
    string name
    string locality
    string country
    float lat
    float lng
    string circuitType
    string circuitImageUrl
    string source
  }

  DriverSeason {
    string id PK
    string driverId FK
    string constructorId FK
    int seasonYear FK
    int driverNumber
  }

  Event {
    string id PK
    int seasonYear FK
    int round
    string jolpikaName
    string officialName
    int openf1MeetingKey
    string circuitId FK
    date date
    string location
    string country
    string countryCode
    string flagUrl
    string gmtOffset
    string source
  }

  Session {
    string id PK
    string eventId FK
    int openf1SessionKey
    enum type
    string name
    datetime dateStart
    datetime dateEnd
    string source
  }

  Result {
    string id PK
    string sessionId FK
    string driverId FK
    string constructorId FK
    int position
    float points
    int grid
    int laps
    string status
    bigint timeMs
    int fastestLapRank
    string source
  }

  QualifyingResult {
    string id PK
    string sessionId FK
    string driverId FK
    string constructorId FK
    int position
    bigint q1Ms
    bigint q2Ms
    bigint q3Ms
    string source
  }

  DriverStanding {
    string id PK
    int seasonYear FK
    string sessionId FK
    string driverId FK
    string constructorId FK
    float points
    int position
    int wins
    string source
  }

  ConstructorStanding {
    string id PK
    int seasonYear FK
    string sessionId FK
    string constructorId FK
    float points
    int position
    int wins
    string source
  }

  LapTime {
    string id PK
    string sessionId FK
    string driverId FK
    int lap
    bigint timeMs
    string source
  }

  PitStop {
    string id PK
    string sessionId FK
    string driverId FK
    int stopNumber
    int lap
    bigint durationMs
    string source
  }

  Season ||--o{ Event : "has"
  Season ||--o{ DriverSeason : "has"
  Season ||--o{ DriverStanding : "has"
  Season ||--o{ ConstructorStanding : "has"

  Driver ||--o{ DriverSeason : "drives in"
  Driver ||--o{ Result : "has"
  Driver ||--o{ QualifyingResult : "has"
  Driver ||--o{ DriverStanding : "has"
  Driver ||--o{ LapTime : "has"
  Driver ||--o{ PitStop : "has"

  Constructor ||--o{ DriverSeason : "employs"
  Constructor ||--o{ Result : "has"
  Constructor ||--o{ QualifyingResult : "has"
  Constructor ||--o{ ConstructorStanding : "has"

  Circuit ||--o{ Event : "hosts"

  Event ||--o{ Session : "has"

  Session ||--o{ Result : "has"
  Session ||--o{ QualifyingResult : "has"
  Session ||--o{ DriverStanding : "after"
  Session ||--o{ ConstructorStanding : "after"
  Session ||--o{ LapTime : "has"
  Session ||--o{ PitStop : "has"
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>F1 Data Server — Schema</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #0f0f0f;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      min-height: 100vh;
    }

    header {
      padding: 24px 32px;
      border-bottom: 1px solid #222;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    header h1 {
      font-size: 20px;
      font-weight: 600;
      color: #fff;
    }

    header span {
      font-size: 13px;
      color: #666;
    }

    nav {
      padding: 0 32px;
      border-bottom: 1px solid #222;
      display: flex;
      gap: 4px;
    }

    nav a {
      display: inline-block;
      padding: 12px 16px;
      font-size: 13px;
      color: #888;
      text-decoration: none;
      border-bottom: 2px solid transparent;
    }

    nav a:hover { color: #fff; }
    nav a.active { color: #e10600; border-bottom-color: #e10600; }

    main {
      padding: 32px;
      overflow: auto;
    }

    h2 {
      font-size: 14px;
      font-weight: 600;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 24px;
    }

    .diagram-wrap {
      background: #161616;
      border: 1px solid #222;
      border-radius: 8px;
      padding: 32px;
      overflow: auto;
    }

    .mermaid {
      display: flex;
      justify-content: center;
    }

    .tables {
      margin-top: 40px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .table-card {
      background: #161616;
      border: 1px solid #222;
      border-radius: 8px;
      overflow: hidden;
    }

    .table-card h3 {
      padding: 12px 16px;
      font-size: 13px;
      font-weight: 600;
      background: #1e1e1e;
      border-bottom: 1px solid #222;
      color: #fff;
    }

    .table-card ul {
      list-style: none;
      padding: 8px 0;
    }

    .table-card li {
      padding: 4px 16px;
      font-size: 12px;
      display: flex;
      justify-content: space-between;
      color: #aaa;
    }

    .table-card li .type {
      color: #555;
      font-family: monospace;
    }

    .pk { color: #e10600 !important; }
    .fk { color: #f59e0b !important; }
  </style>
</head>
<body>
  <header>
    <h1>F1 Data Server</h1>
    <span>Database Schema</span>
  </header>

  <nav>
    <a href="/docs">API Docs</a>
    <a href="/schema" class="active">Schema</a>
    <a href="/health">Health</a>
  </nav>

  <main>
    <h2>Entity Relationship Diagram</h2>

    <div class="diagram-wrap">
      <div class="mermaid">${mermaidDiagram}</div>
    </div>

    <h2 style="margin-top:40px">Tables</h2>

    <div class="tables">
      ${[
        { name: "seasons", fields: [["year","int","PK"],["rounds","int",""]] },
        { name: "drivers", fields: [["id","string","PK"],["jolpikaId","string",""],["firstName","string",""],["lastName","string",""],["code","string",""],["permanentNumber","int",""],["dob","date",""],["nationality","string",""],["headshotUrl","string",""],["countryCode","string",""],["source","string",""]] },
        { name: "constructors", fields: [["id","string","PK"],["jolpikaId","string",""],["name","string",""],["nationality","string",""],["teamColour","string",""],["source","string",""]] },
        { name: "circuits", fields: [["id","string","PK"],["jolpikaId","string",""],["openf1CircuitKey","int",""],["name","string",""],["locality","string",""],["country","string",""],["lat","float",""],["lng","float",""],["circuitType","string",""],["circuitImageUrl","string",""],["source","string",""]] },
        { name: "driver_seasons", fields: [["id","string","PK"],["driverId","string","FK"],["constructorId","string","FK"],["seasonYear","int","FK"],["driverNumber","int",""]] },
        { name: "events", fields: [["id","string","PK"],["seasonYear","int","FK"],["round","int",""],["jolpikaName","string",""],["officialName","string",""],["openf1MeetingKey","int",""],["circuitId","string","FK"],["date","date",""],["location","string",""],["country","string",""],["flagUrl","string",""],["gmtOffset","string",""],["source","string",""]] },
        { name: "sessions", fields: [["id","string","PK"],["eventId","string","FK"],["openf1SessionKey","int",""],["type","enum",""],["name","string",""],["dateStart","datetime",""],["dateEnd","datetime",""],["source","string",""]] },
        { name: "results", fields: [["id","string","PK"],["sessionId","string","FK"],["driverId","string","FK"],["constructorId","string","FK"],["position","int",""],["points","float",""],["grid","int",""],["laps","int",""],["status","string",""],["timeMs","bigint",""],["fastestLapRank","int",""],["source","string",""]] },
        { name: "qualifying_results", fields: [["id","string","PK"],["sessionId","string","FK"],["driverId","string","FK"],["constructorId","string","FK"],["position","int",""],["q1Ms","bigint",""],["q2Ms","bigint",""],["q3Ms","bigint",""],["source","string",""]] },
        { name: "driver_standings", fields: [["id","string","PK"],["seasonYear","int","FK"],["sessionId","string","FK"],["driverId","string","FK"],["constructorId","string","FK"],["points","float",""],["position","int",""],["wins","int",""],["source","string",""]] },
        { name: "constructor_standings", fields: [["id","string","PK"],["seasonYear","int","FK"],["sessionId","string","FK"],["constructorId","string","FK"],["points","float",""],["position","int",""],["wins","int",""],["source","string",""]] },
        { name: "lap_times", fields: [["id","string","PK"],["sessionId","string","FK"],["driverId","string","FK"],["lap","int",""],["timeMs","bigint",""],["source","string",""]] },
        { name: "pit_stops", fields: [["id","string","PK"],["sessionId","string","FK"],["driverId","string","FK"],["stopNumber","int",""],["lap","int",""],["durationMs","bigint",""],["source","string",""]] },
      ].map(t => `
        <div class="table-card">
          <h3>${t.name}</h3>
          <ul>
            ${t.fields.map(([name, type, tag]) => `
              <li>
                <span class="${tag.toLowerCase()}">${name}${tag ? ` <small>${tag}</small>` : ""}</span>
                <span class="type">${type}</span>
              </li>
            `).join("")}
          </ul>
        </div>
      `).join("")}
    </div>
  </main>

  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: "dark",
      er: { diagramPadding: 40, layoutDirection: "TB", minEntityWidth: 100 }
    });
  </script>
</body>
</html>`;

router.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

export default router;
