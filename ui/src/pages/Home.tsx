import { useEffect, useState } from "react";

const BASE = import.meta.env.DEV ? "/api" : "";

interface Stats {
  sessions: number | null;
  results: number | null;
  lapTimes: number | null;
}

interface StudioStatus {
  running: boolean;
}

export default function Home() {
  const [counts, setCounts] = useState({
    seasons: null as number | null,
    drivers: null as number | null,
    constructors: null as number | null,
    circuits: null as number | null,
    events: null as number | null,
  });
  const [stats, setStats] = useState<Stats>({ sessions: null, results: null, lapTimes: null });
  const [studio, setStudio] = useState<StudioStatus>({ running: false });
  const [studioLoading, setStudioLoading] = useState(false);
  const [ts, setTs] = useState("");

  useEffect(() => {
    setTs(new Date().toLocaleString());

    const load = async () => {
      const [seasons, drivers, constructors, circuits, events, statsData, studioData] =
        await Promise.allSettled([
          fetch(`${BASE}/seasons`).then(r => r.json()).then((d: unknown[]) => d.length),
          fetch(`${BASE}/drivers`).then(r => r.json()).then((d: unknown[]) => d.length),
          fetch(`${BASE}/constructors`).then(r => r.json()).then((d: unknown[]) => d.length),
          fetch(`${BASE}/circuits`).then(r => r.json()).then((d: unknown[]) => d.length),
          fetch(`${BASE}/events`).then(r => r.json()).then((d: unknown[]) => d.length),
          fetch(`${BASE}/stats`).then(r => r.json()),
          fetch(`${BASE}/studio/status`).then(r => r.json()),
        ]);

      setCounts({
        seasons: seasons.status === "fulfilled" ? seasons.value as number : null,
        drivers: drivers.status === "fulfilled" ? drivers.value as number : null,
        constructors: constructors.status === "fulfilled" ? constructors.value as number : null,
        circuits: circuits.status === "fulfilled" ? circuits.value as number : null,
        events: events.status === "fulfilled" ? events.value as number : null,
      });
      if (statsData.status === "fulfilled") setStats(statsData.value as Stats);
      if (studioData.status === "fulfilled") setStudio(studioData.value as StudioStatus);
    };

    load();
  }, []);

  const toggleStudio = async () => {
    setStudioLoading(true);
    const endpoint = studio.running ? "/studio/stop" : "/studio/start";
    const res = await fetch(`${BASE}${endpoint}`, { method: "POST" });
    const data = await res.json() as StudioStatus;
    if (data.running) {
      // Give studio a moment to boot
      setTimeout(() => { setStudio({ running: true }); setStudioLoading(false); }, 1500);
    } else {
      setStudio({ running: false });
      setStudioLoading(false);
    }
  };

  const fmt = (n: number | null) => n !== null ? n.toLocaleString() : "—";

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">F1 Data Server</div>
        <div className="page-subtitle">
          Local F1 data hub — full history 1950 to present, automatically kept up to date.
        </div>
        <div className="status-bar">
          <span className="online-dot">Online</span>
          <span>{ts}</span>
        </div>
      </div>

      {/* DB Stats */}
      <div className="section">
        <div className="section-label">Database</div>
        <div className="stats-grid">
          {[
            ["Seasons", counts.seasons],
            ["Drivers", counts.drivers],
            ["Constructors", counts.constructors],
            ["Circuits", counts.circuits],
            ["Events", counts.events],
            ["Sessions", stats.sessions],
            ["Results", stats.results],
            ["Lap Times", stats.lapTimes],
          ].map(([label, value]) => (
            <div key={label as string} className="stat-card">
              <div className="stat-value">{fmt(value as number | null)}</div>
              <div className="stat-label">{label as string}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tools */}
      <div className="section">
        <div className="section-label">Tools</div>
        <div className="cards">
          <a className="card" href="/docs">
            <div className="card-icon">⚡</div>
            <h3>API Playground</h3>
            <p>Interactive Swagger UI. Browse endpoints, view schemas, and fire live queries.</p>
            <span className="card-tag">/docs</span>
          </a>
          <a className="card" href="/schema">
            <div className="card-icon">◈</div>
            <h3>Database Schema</h3>
            <p>Visual ER diagram of all 13 tables with relationships and field reference.</p>
            <span className="card-tag">/schema</span>
          </a>
          <div className="card" style={{ cursor: "default" }}>
            <div className="card-icon">🔍</div>
            <h3>Prisma Studio</h3>
            <p>Visual data browser. Browse, filter, and inspect rows in every table.</p>
            <div className="studio-controls">
              <button
                className={`btn ${studio.running ? "btn-stop" : ""}`}
                onClick={toggleStudio}
                disabled={studioLoading}
              >
                {studioLoading ? "..." : studio.running ? "Stop" : "Start"}
              </button>
              {studio.running && (
                <a className="studio-open" href="http://localhost:5555" target="_blank" rel="noreferrer">
                  Open ↗
                </a>
              )}
              <span className={`status-text ${studio.running ? "running" : ""}`}>
                {studio.running ? "running on :5555" : "stopped"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Endpoints */}
      <div className="section">
        <div className="section-label">REST API — Endpoints</div>
        <div className="endpoints">
          {[
            ["/seasons", "All seasons"],
            ["/seasons/:year", "Season detail with events"],
            ["/drivers", "All drivers — ?season=YYYY to filter"],
            ["/drivers/:id", "Driver detail with season history"],
            ["/constructors", "All constructors — ?season=YYYY to filter"],
            ["/constructors/:id", "Constructor detail with drivers"],
            ["/circuits", "All circuits"],
            ["/circuits/:id", "Circuit detail with recent events"],
            ["/events", "All events — ?season=YYYY to filter"],
            ["/events/:id", "Event detail with sessions and results"],
          ].map(([path, desc]) => (
            <div key={path} className="endpoint">
              <span className="method">GET</span>
              <span className="ep-path">{path}</span>
              <span className="ep-desc">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Data Sources */}
      <div className="section">
        <div className="section-label">Data Sources</div>
        <div className="sources">
          <div className="source">
            <div className="source-dot" style={{ background: "#e10600" }} />
            <div className="source-info">
              <div className="source-name">Jolpica CSV Dump</div>
              <div className="source-desc">Full history 1950–present. Initial load. Free tier has ~14 day delay.</div>
            </div>
            <span className="source-badge">Initial load</span>
          </div>
          <div className="source">
            <div className="source-dot" style={{ background: "#f59e0b" }} />
            <div className="source-info">
              <div className="source-name">Jolpica API</div>
              <div className="source-desc">Near real-time current season. Results, standings, lap times, pit stops.</div>
            </div>
            <span className="source-badge">Auto sync</span>
          </div>
          <div className="source">
            <div className="source-dot" style={{ background: "#3b82f6" }} />
            <div className="source-info">
              <div className="source-name">OpenF1 API</div>
              <div className="source-desc">Enrichment for 2023–present. Team colours, headshots, session metadata.</div>
            </div>
            <span className="source-badge">Auto sync</span>
          </div>
          <div className="source">
            <div className="source-dot" style={{ background: "#333" }} />
            <div className="source-info">
              <div className="source-name">F1 SignalR Live Timing</div>
              <div className="source-desc">Real-time session data. Planned for future integration.</div>
            </div>
            <span className="source-badge">Planned</span>
          </div>
        </div>
      </div>

      {/* Auto update */}
      <div className="section">
        <div className="section-label">Automatic Updates</div>
        <div className="cards">
          <div className="card" style={{ cursor: "default" }}>
            <div className="card-icon">📅</div>
            <h3>Normal periods</h3>
            <p>Checks for stale data every 24 hours and syncs if needed.</p>
          </div>
          <div className="card" style={{ cursor: "default" }}>
            <div className="card-icon">🏁</div>
            <h3>After a race weekend</h3>
            <p>Polls every 30 minutes for up to 48 hours until new race results appear on Jolpica.</p>
          </div>
          <div className="card" style={{ cursor: "default" }}>
            <div className="card-icon">🔄</div>
            <h3>Each sync includes</h3>
            <p>Jolpica results + standings + lap times, followed by OpenF1 enrichment.</p>
          </div>
        </div>
      </div>

      {/* Manual commands */}
      <div className="section">
        <div className="section-label">Manual Commands</div>
        <pre>
          <span className="comment"># Initial full load (1950–present){"\n"}</span>
          <span className="cmd">npm run </span><span className="arg">import:dump{"\n\n"}</span>
          <span className="comment"># Sync current season from Jolpica API{"\n"}</span>
          <span className="cmd">npm run </span><span className="arg">sync:jolpica</span><span className="cmd"> -- </span><span className="arg">2026 2026{"\n\n"}</span>
          <span className="comment"># Enrich with OpenF1 metadata{"\n"}</span>
          <span className="cmd">npm run </span><span className="arg">sync:openf1</span><span className="cmd"> -- </span><span className="arg">2026 2026{"\n\n"}</span>
          <span className="comment"># Apply schema changes{"\n"}</span>
          <span className="cmd">npm run </span><span className="arg">db:push</span><span className="cmd"> && npm run </span><span className="arg">db:generate</span>
        </pre>
      </div>
    </div>
  );
}
