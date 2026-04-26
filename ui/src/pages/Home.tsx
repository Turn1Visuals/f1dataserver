import { useEffect, useState } from "react";

const BASE = import.meta.env.DEV ? "http://localhost:5320" : "";

interface Stats { sessions: number | null; results: number | null; lapTimes: number | null; }
interface StudioStatus { running: boolean; }

const statDefs = [
  { key: "seasons",      label: "Seasons"      },
  { key: "drivers",      label: "Drivers"      },
  { key: "constructors", label: "Constructors" },
  { key: "circuits",     label: "Circuits"     },
  { key: "events",       label: "Events"       },
  { key: "sessions",     label: "Sessions"     },
  { key: "results",      label: "Results"      },
  { key: "lapTimes",     label: "Lap Times"    },
];

const endpoints = [
  ["/seasons",          "All seasons"],
  ["/seasons/:year",    "Season detail with events"],
  ["/drivers",          "All drivers — ?season=YYYY to filter"],
  ["/drivers/:id",      "Driver detail with season history"],
  ["/constructors",     "All constructors — ?season=YYYY to filter"],
  ["/constructors/:id", "Constructor detail with drivers"],
  ["/circuits",         "All circuits"],
  ["/circuits/:id",     "Circuit detail with recent events"],
  ["/events",           "All events — ?season=YYYY to filter"],
  ["/events/:id",       "Event detail with sessions and results"],
];

const sources = [
  { name: "Jolpica CSV Dump",       desc: "Full history 1950–present. Initial load. Free tier has ~14 day delay.", badge: "Initial load", color: "#e10600"  },
  { name: "Jolpica API",            desc: "Near real-time current season. Results, standings, lap times, pit stops.", badge: "Auto sync",    color: "#f59e0b" },
  { name: "OpenF1 API",             desc: "Enrichment for 2023–present. Team colours, headshots, session metadata.", badge: "Auto sync",    color: "#3b82f6" },
  { name: "F1 SignalR Live Timing", desc: "Real-time session data. Planned for future integration.",                badge: "Planned",      color: "#444"    },
];

export default function Home() {
  const [counts, setCounts] = useState<Record<string, number | null>>({
    seasons: null, drivers: null, constructors: null, circuits: null, events: null,
  });
  const [stats, setStats]     = useState<Stats>({ sessions: null, results: null, lapTimes: null });
  const [studio, setStudio]   = useState<StudioStatus>({ running: false });
  const [loading, setLoading] = useState(false);
  const [ts, setTs]           = useState("");

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
        seasons:      seasons.status      === "fulfilled" ? seasons.value as number : null,
        drivers:      drivers.status      === "fulfilled" ? drivers.value as number : null,
        constructors: constructors.status === "fulfilled" ? constructors.value as number : null,
        circuits:     circuits.status     === "fulfilled" ? circuits.value as number : null,
        events:       events.status       === "fulfilled" ? events.value as number : null,
      });
      if (statsData.status  === "fulfilled") setStats(statsData.value as Stats);
      if (studioData.status === "fulfilled") setStudio(studioData.value as StudioStatus);
    };
    load();
  }, []);

  const allCounts: Record<string, number | null> = { ...counts, ...stats };

  const toggleStudio = async () => {
    setLoading(true);
    const res  = await fetch(`${BASE}${studio.running ? "/studio/stop" : "/studio/start"}`, { method: "POST" });
    const data = await res.json() as StudioStatus;
    if (data.running) {
      setTimeout(() => { setStudio({ running: true }); setLoading(false); }, 1500);
    } else {
      setStudio({ running: false }); setLoading(false);
    }
  };

  const shutdown = async () => {
    if (!confirm("Shut down the server?")) return;
    try { await fetch(`${BASE}/shutdown`, { method: "POST" }); } catch { /* expected */ }
  };

  const fmt = (n: number | null) => n !== null ? n.toLocaleString() : "—";

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div className="page-title">F1 Data Server</div>
            <div className="page-sub">Local F1 data hub — full history 1950 to present, automatically kept up to date.</div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={shutdown} style={{ marginTop: 4 }}>Shut down</button>
        </div>
        <div className="status-bar" style={{ marginTop: 12 }}>
          <span className="badge badge-green">Online</span>
          <span style={{ color: "var(--text-3)", fontFamily: "var(--mono)", fontSize: 11 }}>{ts}</span>
        </div>
      </div>

      <div className="divider" />

      {/* Stats */}
      <div className="section">
        <div className="section-label">Database</div>
        <div className="stats-grid">
          {statDefs.map(({ key, label }) => (
            <div key={key} className="stat-card">
              <div className="stat-value">{fmt(allCounts[key] ?? null)}</div>
              <div className="stat-label">{label}</div>
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
            <div className="card-title">API Playground</div>
            <div className="card-desc">Interactive Swagger UI. Browse endpoints, view schemas, and fire live queries.</div>
            <div className="card-tag"><span className="code-tag">/docs</span></div>
          </a>
          <a className="card" href="/schema">
            <div className="card-icon">◈</div>
            <div className="card-title">Database Schema</div>
            <div className="card-desc">Visual ER diagram of all 13 tables with relationships and field reference.</div>
            <div className="card-tag"><span className="code-tag">/schema</span></div>
          </a>
          <div className="card" style={{ cursor: "default" }}>
            <div className="card-icon">🔍</div>
            <div className="card-title">Prisma Studio</div>
            <div className="card-desc">Visual data browser. Browse, filter, and inspect rows in every table.</div>
            <div className="studio-controls">
              <button className={`btn btn-sm ${studio.running ? "btn-danger" : ""}`} onClick={toggleStudio} disabled={loading}>
                {loading ? "…" : studio.running ? "Stop" : "Start"}
              </button>
              {studio.running && (
                <a href="http://localhost:5555" target="_blank" rel="noreferrer" className="studio-link">Open ↗</a>
              )}
              <span className={`badge ${studio.running ? "badge-green" : "badge-dim"}`} style={{ fontSize: 10 }}>
                {studio.running ? "running :5555" : "stopped"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Endpoints */}
      <div className="section">
        <div className="section-label">REST API</div>
        <div className="endpoints">
          {endpoints.map(([path, desc]) => (
            <div key={path} className="endpoint">
              <span className="ep-method">GET</span>
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
          {sources.map(s => (
            <div key={s.name} className="source">
              <div className="source-dot" style={{ background: s.color }} />
              <div className="source-info">
                <div className="source-name">{s.name}</div>
                <div className="source-desc">{s.desc}</div>
              </div>
              <span className="code-tag">{s.badge}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Auto updates */}
      <div className="section">
        <div className="section-label">Automatic Updates</div>
        <div className="cards">
          {[
            { icon: "📅", title: "Normal periods",       desc: "Checks for stale data every 24 hours and syncs if needed."                                  },
            { icon: "🏁", title: "After a race weekend", desc: "Polls every 30 minutes for up to 48 hours until new race results appear on Jolpica."        },
            { icon: "🔄", title: "Each sync includes",   desc: "Jolpica results + standings + lap times, followed by OpenF1 enrichment."                    },
          ].map(c => (
            <div key={c.title} className="card" style={{ cursor: "default" }}>
              <div className="card-icon">{c.icon}</div>
              <div className="card-title">{c.title}</div>
              <div className="card-desc">{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Manual commands */}
      <div className="section">
        <div className="section-label">Manual Commands</div>
        <pre>
          <span className="dim"># Initial full load (1950–present){"\n"}</span>
          <span className="hi">npm run </span><span className="arg">import:dump{"\n\n"}</span>
          <span className="dim"># Sync current season from Jolpica API{"\n"}</span>
          <span className="hi">npm run </span><span className="arg">sync:jolpica</span><span className="hi"> -- </span><span className="arg">2026 2026{"\n\n"}</span>
          <span className="dim"># Enrich with OpenF1 metadata{"\n"}</span>
          <span className="hi">npm run </span><span className="arg">sync:openf1</span><span className="hi"> -- </span><span className="arg">2026 2026{"\n\n"}</span>
          <span className="dim"># Apply schema changes{"\n"}</span>
          <span className="hi">npm run </span><span className="arg">db:push</span><span className="hi"> && npm run </span><span className="arg">db:generate</span>
        </pre>
      </div>
    </div>
  );
}
