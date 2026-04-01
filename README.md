# F1 Data Server

A local F1 data hub that fetches, stores, and serves Formula 1 data from multiple sources. Other projects connect to it via REST and WebSocket. Run it once, keep it updated, use it everywhere.

---

## Overview

### Architecture

```
[External Sources]          [This Server]              [Your Projects]
  Jolpica (CSV dump)  ──►  PostgreSQL database  ──►   REST API
  Jolpica (API)       ──►  (f1data)             ──►   (port 5320)
  OpenF1 (API)        ──►                       ──►   WebSocket /f1
  F1 SignalR          ──►  Session hub           ──►   Web UI (port 5320)
```

### Data Sources

| Source | Role | Coverage |
|--------|------|----------|
| **Jolpica CSV dump** | Initial full history load | 1950–present (14-day delay) |
| **Jolpica API** | Current season results | Near real-time |
| **OpenF1 API** | Enrichment: team colours, headshots, session detail | 2023–present |
| **F1 SignalR** | Live timing stream | Real-time |
| **F1 static archive** | Historic session playback | 2018–present |

### What's stored

- Seasons, drivers, constructors, circuits
- Race weekends (events) and sessions (FP1–3, qualifying, sprint, race)
- Race results, qualifying results, sprint results
- Driver and constructor championship standings
- Lap times and pit stops
- Driver–team mapping per season

---

## Prerequisites

- Node.js 20+
- PostgreSQL 17 (local install or Docker)
- Google Chrome (for F1 account login)

---

## Initial Setup

### 1. Install dependencies

```bash
npm install
cd ui && npm install && cd ..
```

### 2. Configure environment

Edit `.env` and set your PostgreSQL connection string:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/f1data"
PORT=5320
F1_TOKEN=    # optional manual JWT fallback
```

### 3. Create the database

In pgAdmin (or psql), create a database named `f1data`.

### 4. Push the schema

```bash
npm run db:push
```

### 5. Generate Prisma client

```bash
npm run db:generate
```

### 6. Build the web UI

```bash
npm run ui:build
```

Compiles the React frontend into `public/`. The server serves it automatically.

### 7. Load full history

Downloads the Jolpica CSV dump (~13MB) and imports everything from 1950 to present:

```bash
npm run import:dump
```

- Safe to re-run — uses upsert, no duplicates
- Dump is cached in the system temp folder — delete it to force a fresh download
- Has a ~14-day delay on the free tier, so the last couple of races may be missing

### 8. Top up the current season

Pull the latest results directly from the Jolpica API (no delay):

```bash
npm run sync:jolpica -- 2026 2026
```

### 9. Enrich with OpenF1 metadata

Adds team colours, driver headshots, official event names, and session timestamps:

```bash
npm run sync:openf1
```

### 10. Start the server

```bash
npm run dev
```

---

## Running the Server

### Development (auto-restarts on file changes)

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### System tray app

A system tray manager is available in `tray/`. Install it once and it handles starting/stopping the server without a terminal.

See [tray/](#system-tray-app-1) for setup.

Server runs on `http://localhost:5320` by default. Change the port in `.env`.

---

## Web UI

The server includes a built-in web application at `http://localhost:5320`.

### Pages

| Page | URL | Description |
|------|-----|-------------|
| **Home** | `/` | Live DB stats, Prisma Studio toggle, endpoint reference, data sources, shutdown button |
| **API Docs** | `/docs` | Interactive Swagger UI — browse and test all endpoints |
| **Schema** | `/schema` | Mermaid ER diagram of all 13 tables + field reference |
| **Session** | `/session` | F1 account login, live connect, playback, raw data feed |
| **Standings** | `/standings` | Driver and constructor standings by year and round |

### Developing the UI

The frontend lives in `ui/` — React 19 + Vite + TypeScript + vanilla CSS.

**Build for production** (output goes to `public/`, served by Express on port 5320):

```bash
npm run ui:build
```

**Live dev server** (port 5321, proxies API calls to port 5320):

```bash
npm run ui:dev
```

---

## F1 Live Timing

The server can connect to F1's SignalR hub for real-time timing data, or replay cached historic sessions. All connected WebSocket clients receive the same stream.

### Authentication

F1 live timing requires a valid F1 account token. The server handles login via Chrome DevTools Protocol — it opens a Chrome window, you log in once, and the token is saved for future sessions.

1. Open the Session page in the web UI (`http://localhost:5320/session`)
2. Click **Login with F1** — Chrome opens
3. Log in to your F1 account
4. Token is saved to `.f1token.json` in the project root

The persistent Chrome profile is stored in `.chrome-profile/` so re-opening for subsequent logins finds the existing session immediately.

### Live connection

Click **Connect Live** in the Session UI, or:

```
POST /session/live
```

The server negotiates with `livetiming.formula1.com`, subscribes to 20 topics, and streams data to all WebSocket clients. If the connection drops before subscribing, it retries immediately and automatically. Click **Disconnect** (or `POST /session/live/disconnect`) to abort.

### Session playback

Historic sessions are fetched on demand from the F1 static archive and cached as NDJSON on disk (`sessions/`). Once cached they load instantly without re-fetching.

```
GET  /session/index?year=2026     → list all meetings and sessions
POST /session/load                → fetch (if not cached) and load a session
POST /session/play                → start playback { speed: 1 }
POST /session/pause
GET  /session/cached              → list sessions cached on disk
```

One session is active at a time — connecting live or loading a playback session always unloads the previous one first.

### Broadcast delay

```
POST /session/delay    { ms: 30000 }    → 30 second delay
```

Also configurable in the Session UI with presets (0 / 15 / 30 / 45 / 60s).

### WebSocket stream

Connect to `ws://localhost:5320/f1`. On connect you receive the current status and a full state snapshot. Ongoing messages:

| Type | Payload | Description |
|------|---------|-------------|
| `status` | `SessionStatus` | Mode, offset, speed, delay, etc. |
| `snapshot` | `{ state }` | Full merged state across all topics |
| `data` | `{ topic, data }` | Individual timing update |
| `circuit` | `{ data }` | Circuit layout from MultiViewer API |
| `liveDisconnected` | — | Live feed dropped |
| `ended` | — | Playback finished |
| `error` | `{ message }` | Error from the session hub |

### Raw data feed

The Session page shows a live scrolling log of all incoming `data` messages. Filter by topic, pause/resume, or clear. Capped at 500 entries.

---

## Automatic Updates

The server keeps historical data up to date automatically.

| Situation | Check interval | Action |
|-----------|---------------|--------|
| Normal (no recent race) | Every 24 hours | Sync if stale |
| Within 48h after a race | Every 30 minutes | Sync as soon as data is available |

Each sync runs Jolpica (results + standings) and OpenF1 (enrichment) for the current season.

---

## REST API

All endpoints are documented interactively at `http://localhost:5320/docs`.

### Health & admin

```
GET  /health
GET  /stats          → session, result, and lap time counts
POST /shutdown       → gracefully stop the server
```

### Seasons

```
GET /seasons
GET /seasons/:year
```

### Drivers

```
GET /drivers
GET /drivers?season=2026
GET /drivers/:id
```

### Constructors

```
GET /constructors
GET /constructors?season=2026
GET /constructors/:id
```

### Circuits

```
GET /circuits
GET /circuits/:id
```

### Events

```
GET /events
GET /events?season=2026
GET /events/:id
```

### Standings

```
GET /standings/:year/drivers?round=N
GET /standings/:year/constructors?round=N
```

Omit `round` to get the latest available round. Standings are stored per Race session and updated automatically each sync.

### F1 status

```
GET /event-tracker      → current F1 event info (1-min cache)
GET /streaming-status   → F1 live timing status (15-sec cache)
```

### Session control

```
GET  /session/status
GET  /session/circuit
POST /session/live
POST /session/live/disconnect
POST /session/load              { sessionPath }
POST /session/play              { speed }
POST /session/pause
POST /session/delay             { ms }
GET  /session/index?year=2026
GET  /session/cached
GET  /session/auth/status
POST /session/auth/login
POST /session/auth/logout
```

---

## Database

### Prisma Studio (visual browser)

Start from the web UI home page or from terminal:

```bash
npm run db:studio
```

Opens at `http://localhost:5555`.

### Schema changes

```bash
npm run db:push       # apply changes to the database
npm run db:generate   # regenerate the Prisma client
```

### Maintenance scripts

```bash
# One-time cleanup of duplicate records (dump vs API ID mismatch)
npm run db:dedup-constructors
npm run db:dedup-drivers

# Re-sync standings for a specific season if data was lost
npm run sync:standings-2026
```

---

## System Tray App

A lightweight Electron tray app in `tray/` manages the server without a terminal. It auto-starts the server on launch and sits in the Windows system tray.

### Build the installer

```bash
cd tray
npm install
npm run build
```

Produces `tray/dist/F1 Data Server Setup 1.0.0.exe`.

### First run

On first launch the tray app asks you to select your `.env` file. It copies it to `AppData\Roaming\f1dataserver-tray\` and starts the server. All runtime data (Chrome profile, F1 token, sessions cache) also goes to that folder when running packaged.

### Tray menu

- **Start Server** — spawns the server
- **Stop Server** — gracefully shuts it down
- **Open UI** — opens `http://localhost:5320` in your browser
- **Quit** — stops the server and exits the tray

Left-clicking the tray icon opens the UI directly if the server is running.

### Rebuilding after server changes

```bash
cd tray && npm run build
```

---

## Project Structure

```
f1dataserver/
├── tray/                              ← Electron system tray app + installer
│   ├── main.js                        ← tray logic (start/stop/menu)
│   ├── build-server.js                ← esbuild bundler for server.cjs
│   ├── build-icon.js                  ← converts favicon.svg → icon.png
│   └── dist/                          ← built installer output (gitignored)
├── ui/                                ← React frontend (Vite + TypeScript)
│   └── src/
│       ├── pages/
│       │   ├── Home.tsx               ← dashboard + shutdown button
│       │   ├── ApiDocs.tsx            ← Swagger UI embed
│       │   ├── Schema.tsx             ← Mermaid ER diagram
│       │   ├── Session.tsx            ← F1 session control + raw data feed
│       │   └── Standings.tsx          ← driver/constructor standings browser
│       ├── App.tsx                    ← sidebar layout + routing
│       └── main.tsx
├── public/                            ← built UI output (served by Express)
├── prisma/
│   └── schema.prisma                  ← database schema
├── src/
│   ├── db/
│   │   └── client.ts                  ← Prisma client singleton
│   ├── f1/
│   │   ├── auth.ts                    ← F1 token management + Chrome CDP login
│   │   ├── livefeed.ts                ← F1 SignalR WebSocket client
│   │   ├── session-manager.ts         ← live/playback hub with delay buffer
│   │   ├── fetch.ts                   ← F1 static archive fetcher
│   │   ├── cache.ts                   ← NDJSON session cache
│   │   └── circuits.ts                ← circuit layout fetcher (MultiViewer API)
│   ├── server/
│   │   ├── index.ts                   ← Express app entry point
│   │   ├── swagger.ts                 ← OpenAPI spec
│   │   ├── ws.ts                      ← WebSocket server (/f1)
│   │   └── routes/
│   │       ├── seasons.ts
│   │       ├── drivers.ts
│   │       ├── constructors.ts
│   │       ├── circuits.ts
│   │       ├── events.ts
│   │       ├── standings.ts           ← driver/constructor standings
│   │       ├── event-tracker.ts       ← F1 event tracker proxy
│   │       ├── streaming-status.ts    ← F1 streaming status proxy
│   │       ├── session.ts             ← session control endpoints
│   │       ├── auth.ts                ← F1 auth endpoints
│   │       └── studio.ts              ← Prisma Studio start/stop
│   └── sync/
│       ├── scheduler.ts               ← automatic update scheduler
│       ├── startup-sync.ts
│       ├── sources/
│       │   ├── jolpica.ts
│       │   └── openf1.ts
│       └── scripts/
│           ├── import-dump.ts
│           ├── sync-jolpica.ts
│           ├── sync-openf1.ts
│           ├── dedup-constructors.ts  ← one-time duplicate cleanup
│           ├── dedup-drivers.ts       ← one-time duplicate cleanup
│           └── resync-standings-2026.ts
├── sessions/                          ← cached session NDJSON files (gitignored)
├── .chrome-profile/                   ← persistent Chrome profile (gitignored)
├── .f1token.json                      ← saved F1 token (gitignored)
└── .env                               ← local config (gitignored)
```

---

## Planned

- GraphQL API alongside REST
- Tray app: download and install server updates from GitHub releases
