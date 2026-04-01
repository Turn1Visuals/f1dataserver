import { useEffect, useRef } from "react";
import mermaid from "mermaid";

const diagram = `
erDiagram
  Season ||--o{ DriverSeason : has
  Season ||--o{ Event : has
  Season ||--o{ DriverStanding : has
  Season ||--o{ ConstructorStanding : has
  Driver ||--o{ DriverSeason : has
  Driver ||--o{ Result : has
  Driver ||--o{ QualifyingResult : has
  Driver ||--o{ DriverStanding : has
  Driver ||--o{ LapTime : has
  Driver ||--o{ PitStop : has
  Constructor ||--o{ DriverSeason : has
  Constructor ||--o{ Result : has
  Constructor ||--o{ ConstructorStanding : has
  Circuit ||--o{ Event : held_at
  Event ||--o{ Session : has
  Session ||--o{ Result : has
  Session ||--o{ QualifyingResult : has
  Session ||--o{ LapTime : has
  Session ||--o{ PitStop : has
`;

const tables = [
  { name: "Season", fields: ["id (PK)", "year", "url", "source", "syncedAt"] },
  { name: "Driver", fields: ["id (PK)", "driverRef", "givenName", "familyName", "nationality", "dateOfBirth", "permanentNumber", "code", "headshotUrl", "source"] },
  { name: "Constructor", fields: ["id (PK)", "constructorRef", "name", "nationality", "teamColour", "source"] },
  { name: "Circuit", fields: ["id (PK)", "circuitRef", "name", "locality", "country", "lat", "lng", "source"] },
  { name: "DriverSeason", fields: ["id (PK)", "driverId (FK)", "constructorId (FK)", "seasonId (FK)", "number", "source"] },
  { name: "Event", fields: ["id (PK)", "seasonId (FK)", "circuitId (FK)", "round", "name", "officialName", "date", "source"] },
  { name: "Session", fields: ["id (PK)", "eventId (FK)", "type (enum)", "date", "openf1Key", "source"] },
  { name: "Result", fields: ["id (PK)", "sessionId (FK)", "driverId (FK)", "constructorId (FK)", "grid", "position", "points", "status", "source"] },
  { name: "QualifyingResult", fields: ["id (PK)", "sessionId (FK)", "driverId (FK)", "constructorId (FK)", "position", "q1", "q2", "q3", "source"] },
  { name: "DriverStanding", fields: ["id (PK)", "seasonId (FK)", "driverId (FK)", "points", "position", "wins", "source"] },
  { name: "ConstructorStanding", fields: ["id (PK)", "seasonId (FK)", "constructorId (FK)", "points", "position", "wins", "source"] },
  { name: "LapTime", fields: ["id (PK)", "sessionId (FK)", "driverId (FK)", "lap", "position", "time", "millis", "source"] },
  { name: "PitStop", fields: ["id (PK)", "sessionId (FK)", "driverId (FK)", "stop", "lap", "time", "duration", "source"] },
];

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    background: "#161616",
    primaryColor: "#1e1e1e",
    primaryBorderColor: "#333",
    primaryTextColor: "#e0e0e0",
    lineColor: "#444",
    edgeLabelBackground: "#161616",
  },
});

export default function Schema() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    mermaid.render("erd", diagram.trim()).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    });
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Database Schema</div>
        <div className="page-subtitle">
          Entity-relationship diagram for all 13 tables. Each table tracks <code style={{ fontSize: 11, padding: "1px 6px", background: "#1e1e1e", borderRadius: 4, color: "#aaa" }}>source</code>, <code style={{ fontSize: 11, padding: "1px 6px", background: "#1e1e1e", borderRadius: 4, color: "#aaa" }}>createdAt</code>, <code style={{ fontSize: 11, padding: "1px 6px", background: "#1e1e1e", borderRadius: 4, color: "#aaa" }}>updatedAt</code>, and <code style={{ fontSize: 11, padding: "1px 6px", background: "#1e1e1e", borderRadius: 4, color: "#aaa" }}>syncedAt</code>.
        </div>
      </div>

      <div className="section">
        <div className="section-label">ER Diagram</div>
        <div
          ref={ref}
          style={{
            background: "#161616",
            border: "1px solid #222",
            borderRadius: 10,
            padding: "24px",
            overflowX: "auto",
            minHeight: 200,
          }}
        />
      </div>

      <div className="section">
        <div className="section-label">Table Reference</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {tables.map(t => (
            <div key={t.name} style={{ background: "#161616", border: "1px solid #222", borderRadius: 8, padding: "16px 18px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 10 }}>{t.name}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {t.fields.map(f => {
                  const isPk = f.includes("(PK)");
                  const isFk = f.includes("(FK)");
                  return (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                      <span style={{
                        display: "inline-block",
                        width: 18,
                        fontSize: 9,
                        fontWeight: 700,
                        color: isPk ? "#f59e0b" : isFk ? "#3b82f6" : "transparent",
                      }}>
                        {isPk ? "PK" : isFk ? "FK" : ""}
                      </span>
                      <span style={{ color: "#aaa", fontFamily: "var(--mono)" }}>
                        {f.replace(" (PK)", "").replace(" (FK)", "")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
