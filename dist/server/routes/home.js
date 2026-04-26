import { Router } from "express";
const router = Router();
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>F1 Data Server</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #0f0f0f;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      min-height: 100vh;
    }

    header {
      padding: 48px 48px 32px;
      border-bottom: 1px solid #1e1e1e;
    }

    .header-inner {
      max-width: 1100px;
      margin: 0 auto;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 16px;
    }

    .logo-dot {
      width: 12px;
      height: 12px;
      background: #e10600;
      border-radius: 50%;
    }

    header h1 {
      font-size: 28px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.02em;
    }

    header p {
      font-size: 15px;
      color: #666;
      max-width: 600px;
      line-height: 1.6;
    }

    .status-bar {
      margin-top: 20px;
      display: flex;
      align-items: center;
      gap: 20px;
      font-size: 13px;
      color: #555;
    }

    .status-online {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #4ade80;
    }

    .status-online::before {
      content: "";
      display: block;
      width: 7px;
      height: 7px;
      background: #4ade80;
      border-radius: 50%;
    }

    nav {
      border-bottom: 1px solid #1e1e1e;
    }

    nav .inner {
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      gap: 4px;
      padding: 0 48px;
    }

    nav a {
      display: inline-block;
      padding: 14px 16px;
      font-size: 13px;
      color: #888;
      text-decoration: none;
      border-bottom: 2px solid transparent;
    }

    nav a:hover { color: #fff; }
    nav a.active { color: #e10600; border-bottom-color: #e10600; }

    main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 48px;
    }

    .section { margin-bottom: 56px; }

    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #555;
      margin-bottom: 20px;
    }

    /* Cards */
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }

    .card {
      background: #161616;
      border: 1px solid #222;
      border-radius: 10px;
      padding: 24px;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.15s, background 0.15s;
      display: block;
    }

    .card:hover {
      border-color: #444;
      background: #1a1a1a;
    }

    .card-icon {
      font-size: 22px;
      margin-bottom: 12px;
    }

    .card h3 {
      font-size: 15px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 6px;
    }

    .card p {
      font-size: 13px;
      color: #666;
      line-height: 1.6;
    }

    .card .tag {
      display: inline-block;
      margin-top: 14px;
      padding: 3px 10px;
      background: #1e1e1e;
      border: 1px solid #333;
      border-radius: 4px;
      font-size: 11px;
      color: #888;
      font-family: monospace;
    }

    /* Endpoints */
    .endpoints { display: flex; flex-direction: column; gap: 6px; }

    .endpoint {
      display: flex;
      align-items: baseline;
      gap: 12px;
      padding: 10px 14px;
      background: #161616;
      border: 1px solid #1e1e1e;
      border-radius: 6px;
      font-family: monospace;
      font-size: 13px;
    }

    .method {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
      background: #1a3a1a;
      color: #4ade80;
      min-width: 42px;
      text-align: center;
    }

    .path { color: #e0e0e0; }

    .desc {
      font-family: -apple-system, sans-serif;
      font-size: 12px;
      color: #555;
      margin-left: auto;
    }

    /* Data stats */
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
    }

    .stat {
      background: #161616;
      border: 1px solid #222;
      border-radius: 8px;
      padding: 20px;
    }

    .stat-value {
      font-size: 26px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.02em;
    }

    .stat-label {
      font-size: 12px;
      color: #555;
      margin-top: 4px;
    }

    /* Sources */
    .sources { display: flex; flex-direction: column; gap: 8px; }

    .source {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 16px;
      background: #161616;
      border: 1px solid #1e1e1e;
      border-radius: 8px;
    }

    .source-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .source-info { flex: 1; }

    .source-name {
      font-size: 13px;
      font-weight: 600;
      color: #fff;
    }

    .source-desc {
      font-size: 12px;
      color: #555;
      margin-top: 2px;
    }

    .source-badge {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 4px;
      background: #1e1e1e;
      color: #666;
      border: 1px solid #2a2a2a;
    }

    /* Code block */
    pre {
      background: #161616;
      border: 1px solid #222;
      border-radius: 8px;
      padding: 20px;
      font-size: 13px;
      line-height: 1.7;
      color: #aaa;
      overflow-x: auto;
    }

    pre .comment { color: #555; }
    pre .cmd { color: #e0e0e0; }
    pre .arg { color: #93c5fd; }

    footer {
      border-top: 1px solid #1e1e1e;
      padding: 24px 48px;
      font-size: 12px;
      color: #444;
      text-align: center;
    }
  </style>
</head>
<body>

<header>
  <div class="header-inner">
    <div class="logo">
      <div class="logo-dot"></div>
      <h1>F1 Data Server</h1>
    </div>
    <p>Local F1 data hub — full history from 1950 to present, automatically kept up to date. Serves historical and current season data to all your projects via REST.</p>
    <div class="status-bar">
      <span class="status-online">Online</span>
      <span id="ts">—</span>
    </div>
  </div>
</header>

<nav>
  <div class="inner">
    <a href="/" class="active">Home</a>
    <a href="/docs">API Docs</a>
    <a href="/schema">Schema</a>
    <a href="/health">Health</a>
  </div>
</nav>

<main>

  <!-- Tools -->
  <section class="section">
    <div class="section-title">Tools</div>
    <div class="cards">
      <a class="card" href="/docs">
        <div class="card-icon">⚡</div>
        <h3>API Playground</h3>
        <p>Interactive Swagger UI. Browse all endpoints, view request/response schemas, and fire live queries against your local data.</p>
        <span class="tag">/docs</span>
      </a>
      <a class="card" href="/schema">
        <div class="card-icon">🗄️</div>
        <h3>Database Schema</h3>
        <p>Visual ER diagram of all 13 tables with relationships. Includes a full field reference with types and key annotations.</p>
        <span class="tag">/schema</span>
      </a>
      <div class="card" style="cursor:default" id="studio-card">
        <div class="card-icon">🔍</div>
        <h3>Prisma Studio</h3>
        <p>Visual data browser. Browse, filter, and inspect rows in every table.</p>
        <div style="margin-top:14px;display:flex;align-items:center;gap:10px">
          <button id="studio-btn" onclick="studioToggle()" style="padding:6px 14px;border-radius:6px;border:1px solid #333;background:#1e1e1e;color:#e0e0e0;font-size:12px;cursor:pointer">—</button>
          <a id="studio-link" href="http://localhost:5555" target="_blank" style="display:none;font-size:12px;color:#3b82f6;text-decoration:none">Open ↗</a>
          <span id="studio-status" style="font-size:12px;color:#555">checking...</span>
        </div>
      </div>
    </div>
  </section>

  <!-- Stats -->
  <section class="section">
    <div class="section-title">Database</div>
    <div class="stats" id="stats">
      <div class="stat"><div class="stat-value">—</div><div class="stat-label">Seasons</div></div>
      <div class="stat"><div class="stat-value">—</div><div class="stat-label">Drivers</div></div>
      <div class="stat"><div class="stat-value">—</div><div class="stat-label">Constructors</div></div>
      <div class="stat"><div class="stat-value">—</div><div class="stat-label">Circuits</div></div>
      <div class="stat"><div class="stat-value">—</div><div class="stat-label">Events</div></div>
      <div class="stat"><div class="stat-value">—</div><div class="stat-label">Sessions</div></div>
      <div class="stat"><div class="stat-value">—</div><div class="stat-label">Results</div></div>
      <div class="stat"><div class="stat-value">—</div><div class="stat-label">Lap Times</div></div>
    </div>
  </section>

  <!-- API Endpoints -->
  <section class="section">
    <div class="section-title">REST API — Endpoints</div>
    <div class="endpoints">
      <div class="endpoint"><span class="method">GET</span><span class="path">/seasons</span><span class="desc">All seasons</span></div>
      <div class="endpoint"><span class="method">GET</span><span class="path">/seasons/:year</span><span class="desc">Season detail with events</span></div>
      <div class="endpoint"><span class="method">GET</span><span class="path">/drivers</span><span class="desc">All drivers — ?season=YYYY to filter</span></div>
      <div class="endpoint"><span class="method">GET</span><span class="path">/drivers/:id</span><span class="desc">Driver detail with full season history</span></div>
      <div class="endpoint"><span class="method">GET</span><span class="path">/constructors</span><span class="desc">All constructors — ?season=YYYY to filter</span></div>
      <div class="endpoint"><span class="method">GET</span><span class="path">/constructors/:id</span><span class="desc">Constructor detail with drivers</span></div>
      <div class="endpoint"><span class="method">GET</span><span class="path">/circuits</span><span class="desc">All circuits</span></div>
      <div class="endpoint"><span class="method">GET</span><span class="path">/circuits/:id</span><span class="desc">Circuit detail with recent events</span></div>
      <div class="endpoint"><span class="method">GET</span><span class="path">/events</span><span class="desc">All events — ?season=YYYY to filter</span></div>
      <div class="endpoint"><span class="method">GET</span><span class="path">/events/:id</span><span class="desc">Event detail with sessions and results</span></div>
    </div>
  </section>

  <!-- Data Sources -->
  <section class="section">
    <div class="section-title">Data Sources</div>
    <div class="sources">
      <div class="source">
        <div class="source-dot" style="background:#e10600"></div>
        <div class="source-info">
          <div class="source-name">Jolpica CSV Dump</div>
          <div class="source-desc">Full history 1950–present. Used for initial load. Free tier has ~14 day delay.</div>
        </div>
        <span class="source-badge">Initial load</span>
      </div>
      <div class="source">
        <div class="source-dot" style="background:#f59e0b"></div>
        <div class="source-info">
          <div class="source-name">Jolpica API</div>
          <div class="source-desc">Near real-time current season data. Race results, standings, lap times, pit stops.</div>
        </div>
        <span class="source-badge">Auto sync</span>
      </div>
      <div class="source">
        <div class="source-dot" style="background:#3b82f6"></div>
        <div class="source-info">
          <div class="source-name">OpenF1 API</div>
          <div class="source-desc">Enrichment for 2023–present. Team colours, driver headshots, session metadata.</div>
        </div>
        <span class="source-badge">Auto sync</span>
      </div>
      <div class="source">
        <div class="source-dot" style="background:#333"></div>
        <div class="source-info">
          <div class="source-name">F1 SignalR Live Timing</div>
          <div class="source-desc">Real-time session data. Planned for future integration.</div>
        </div>
        <span class="source-badge">Planned</span>
      </div>
    </div>
  </section>

  <!-- Auto update -->
  <section class="section">
    <div class="section-title">Automatic Updates</div>
    <div class="cards">
      <div class="card" style="cursor:default">
        <div class="card-icon">📅</div>
        <h3>Normal periods</h3>
        <p>Checks for stale data every 24 hours and syncs if needed.</p>
      </div>
      <div class="card" style="cursor:default">
        <div class="card-icon">🏁</div>
        <h3>After a race weekend</h3>
        <p>Polls every 30 minutes for up to 48 hours until new race results appear on Jolpica.</p>
      </div>
      <div class="card" style="cursor:default">
        <div class="card-icon">🔄</div>
        <h3>Each sync includes</h3>
        <p>Jolpica results + standings + lap times, followed by OpenF1 enrichment for team colours and headshots.</p>
      </div>
    </div>
  </section>

  <!-- Manual commands -->
  <section class="section">
    <div class="section-title">Manual Commands</div>
    <pre><span class="comment"># Initial full load (1950–present)</span>
<span class="cmd">npm run</span> <span class="arg">import:dump</span>

<span class="comment"># Sync current season from Jolpica API</span>
<span class="cmd">npm run</span> <span class="arg">sync:jolpica</span> -- <span class="arg">2026 2026</span>

<span class="comment"># Enrich with OpenF1 metadata</span>
<span class="cmd">npm run</span> <span class="arg">sync:openf1</span> -- <span class="arg">2026 2026</span>

<span class="comment"># Open Prisma data browser</span>
<span class="cmd">npm run</span> <span class="arg">db:studio</span>

<span class="comment"># Apply schema changes</span>
<span class="cmd">npm run</span> <span class="arg">db:push</span> <span class="comment">&& npm run</span> <span class="arg">db:generate</span></pre>
  </section>

</main>

<footer>
  F1 Data Server — TURN1VISUALS
</footer>

<script>
  // Timestamp
  document.getElementById("ts").textContent = new Date().toLocaleString();

  // Load stats
  const statLabels = ["Seasons","Drivers","Constructors","Circuits","Events","Sessions","Results","Lap Times"];
  const statEndpoints = ["/seasons","/drivers","/constructors","/circuits","/events?season=2026",null,null,null];

  async function loadStats() {
    const endpoints = [
      { url: "/seasons", label: "Seasons" },
      { url: "/drivers", label: "Drivers" },
      { url: "/constructors", label: "Constructors" },
      { url: "/circuits", label: "Circuits" },
      { url: "/events", label: "Events" },
      { url: "/seasons", label: "Sessions" },
      { url: "/seasons", label: "Results" },
      { url: "/seasons", label: "Lap Times" },
    ];

    const statsData = await fetch("/stats").then(r=>r.json()).catch(()=>({}));
    const counts = await Promise.all([
      fetch("/seasons").then(r=>r.json()).then(d=>d.length),
      fetch("/drivers").then(r=>r.json()).then(d=>d.length),
      fetch("/constructors").then(r=>r.json()).then(d=>d.length),
      fetch("/circuits").then(r=>r.json()).then(d=>d.length),
      fetch("/events").then(r=>r.json()).then(d=>d.length),
      Promise.resolve(statsData.sessions ?? null),
      Promise.resolve(statsData.results ?? null),
      Promise.resolve(statsData.lapTimes ?? null),
    ]);

    const cards = document.querySelectorAll("#stats .stat");
    const labels = ["Seasons","Drivers","Constructors","Circuits","Events","Sessions","Results","Lap Times"];
    counts.forEach((count, i) => {
      if (cards[i]) {
        cards[i].querySelector(".stat-value").textContent =
          count !== null ? count.toLocaleString() : "—";
      }
    });
  }

  loadStats();

  // Prisma Studio control
  async function studioSetUI(running) {
    const btn = document.getElementById("studio-btn");
    const link = document.getElementById("studio-link");
    const status = document.getElementById("studio-status");
    if (running) {
      btn.textContent = "Stop";
      btn.style.borderColor = "#7f1d1d";
      btn.style.color = "#f87171";
      link.style.display = "inline";
      status.textContent = "running on :5555";
      status.style.color = "#4ade80";
    } else {
      btn.textContent = "Start";
      btn.style.borderColor = "#333";
      btn.style.color = "#e0e0e0";
      link.style.display = "none";
      status.textContent = "stopped";
      status.style.color = "#555";
    }
  }

  async function studioToggle() {
    const btn = document.getElementById("studio-btn");
    const running = btn.textContent === "Stop";
    btn.disabled = true;
    const res = await fetch(running ? "/studio/stop" : "/studio/start", { method: "POST" });
    const data = await res.json();
    // small delay so studio has time to boot
    if (data.running) setTimeout(() => { btn.disabled = false; studioSetUI(true); }, 1500);
    else { btn.disabled = false; studioSetUI(false); }
  }

  fetch("/studio/status").then(r=>r.json()).then(d=>studioSetUI(d.running));
</script>
</body>
</html>`;
router.get("/", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send(html);
});
export default router;
//# sourceMappingURL=home.js.map