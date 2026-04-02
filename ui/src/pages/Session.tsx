import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import "./Session.css";

const BASE = import.meta.env.DEV ? "http://localhost:5320" : "";
const WS_URL = import.meta.env.DEV ? "ws://localhost:5320/f1" : `ws://${location.host}/f1`;

// "2026/2026-03-29_Japanese_Grand_Prix/2026-03-29_Race/" → "Japanese Grand Prix — Race"
function formatSessionPath(p: string): string {
  const parts = p.replace(/\/$/, "").split("/");
  const session = parts[2] ?? parts[1] ?? p;
  const stripDate = (s: string) => s.replace(/^\d{4}-\d{2}-\d{2}_/, "").replace(/_/g, " ");
  if (parts.length >= 3) {
    const event = stripDate(parts[1]!);
    return `${event} — ${stripDate(session)}`;
  }
  return stripDate(session);
}

interface AuthStatus {
  loggedIn: boolean;
  expiresAt: string | null;
  pending: boolean;
}

interface SessionStatus {
  mode: "idle" | "live" | "playback";
  sessionPath: string | null;
  playing: boolean;
  offsetMs: number;
  durationMs: number;
  speed: number;
  delayMs: number;
  snapshotReady: boolean;
}

interface Meeting {
  name: string;
  key: string;
  location?: string;
  sessions: Array<{ name: string; path: string; cached: boolean }>;
}

interface CachedSession {
  sessionPath: string;
  year: number;
  sizeBytes: number;
}

interface Timetable {
  startTime: string;
  endTime: string;
  gmtOffset: string;
  description: string;
  state: "upcoming" | "live" | "completed" | string;
}

interface EventTracker {
  race?: { meetingName?: string; meetingCountryCode?: string };
  seasonContext?: { timetables?: Timetable[] };
}

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function Session() {
  const [auth, setAuth] = useState<AuthStatus>({ loggedIn: false, expiresAt: null, pending: false });
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [cached, setCached] = useState<CachedSession[]>([]);
  const [loadingIndex, setLoadingIndex] = useState(false);
  const [loadingSession, setLoadingSession] = useState<string | null>(null);
  const [delay, setDelay] = useState(0);
  const [delayInput, setDelayInput] = useState("0");
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);
  const [streamingStatus, setStreamingStatus] = useState<string | null>(null);
  const [eventTracker, setEventTracker] = useState<EventTracker | null>(null);
  const [feed, setFeed] = useState<Array<{ ts: number; topic: string; data: unknown }>>([]);
  const [feedPaused, setFeedPaused] = useState(false);
  const [feedFilter, setFeedFilter] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const feedPausedRef = useRef(false);

  // Fetch auth + session status
  const refresh = useCallback(async () => {
    const [a, s, c] = await Promise.allSettled([
      fetch(`${BASE}/session/auth/status`).then(r => r.json()),
      fetch(`${BASE}/session/status`).then(r => r.json()),
      fetch(`${BASE}/session/cached`).then(r => r.json()),
    ]);
    if (a.status === "fulfilled") setAuth(a.value as AuthStatus);
    if (s.status === "fulfilled") setStatus(s.value as SessionStatus);
    if (c.status === "fulfilled") setCached(c.value as CachedSession[]);
  }, []);

  // WebSocket connection
  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data as string) as { type: string; topic?: string; data?: unknown } & Partial<SessionStatus>;
        if (msg.type === "status") {
          setStatus(msg as SessionStatus);
          setDelay(msg.delayMs ?? 0);
        }
        if (msg.type === "data" && msg.topic && !feedPausedRef.current) {
          setFeed(prev => {
            const next = [...prev, { ts: Date.now(), topic: msg.topic!, data: msg.data }];
            return next.length > 500 ? next.slice(-500) : next;
          });
        }
      };
    }
    connect();
    return () => wsRef.current?.close();
  }, []);

  // Poll auth status while login pending
  useEffect(() => {
    if (auth.pending) {
      pollRef.current = setInterval(refresh, 2000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [auth.pending, refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  // Fetch streaming status + event tracker once on mount, then every 30s
  useEffect(() => {
    const fetchF1Status = async () => {
      const [ss, et] = await Promise.allSettled([
        fetch(`${BASE}/streaming-status`).then(r => r.json()),
        fetch(`${BASE}/event-tracker`).then(r => r.json()),
      ]);
      if (ss.status === "fulfilled") setStreamingStatus((ss.value as { Status?: string }).Status ?? null);
      if (et.status === "fulfilled") setEventTracker(et.value as EventTracker);
    };
    fetchF1Status();
    const id = setInterval(fetchF1Status, 30_000);
    return () => clearInterval(id);
  }, []);

  // Keep pausedRef in sync
  useEffect(() => { feedPausedRef.current = feedPaused; }, [feedPaused]);

  // Auto-scroll feed to bottom when not paused
  useEffect(() => {
    if (!feedPaused) feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [feed, feedPaused]);

  const filteredFeed = useMemo(() => {
    if (!feedFilter) return feed;
    const f = feedFilter.toLowerCase();
    return feed.filter(e => e.topic.toLowerCase().includes(f));
  }, [feed, feedFilter]);

  // Auth actions
  const login = async () => {
    await fetch(`${BASE}/session/auth/login`, { method: "POST" });
    setAuth(a => ({ ...a, pending: true }));
  };
  const logout = async () => {
    await fetch(`${BASE}/session/auth/logout`, { method: "POST" });
    refresh();
  };

  // Session actions
  const connectLive = async () => {
    await fetch(`${BASE}/session/live`, { method: "POST" });
    refresh();
  };
  const disconnectLive = async () => {
    await fetch(`${BASE}/session/live/disconnect`, { method: "POST" });
    refresh();
  };
  const loadSession = async (path: string) => {
    setLoadingSession(path);
    await fetch(`${BASE}/session/load`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionPath: path }),
    });
    setLoadingSession(null);
    refresh();
  };
  const play = (speed = 1) =>
    fetch(`${BASE}/session/play`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ speed }) }).then(refresh);
  const pause = () =>
    fetch(`${BASE}/session/pause`, { method: "POST" }).then(refresh);
  const applyDelay = () => {
    const ms = parseInt(delayInput) || 0;
    fetch(`${BASE}/session/delay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ms }) }).then(refresh);
  };

  const loadIndex = async () => {
    setLoadingIndex(true);
    const res = await fetch(`${BASE}/session/index?year=${year}`);
    const data = await res.json() as Meeting[];
    setMeetings(data);
    setLoadingIndex(false);
  };

  const progress = status && status.durationMs > 0
    ? (status.offsetMs / status.durationMs) * 100
    : 0;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Session</div>
        <div className="page-subtitle">Live F1 timing connection and session playback.</div>
      </div>

      {/* Status bar */}
      <div className="section">
        <div className="section-label">Connection</div>
        <div className="s-row">
          <div className="s-card">
            <div className="s-card-label">WebSocket</div>
            <div className={`s-badge ${wsConnected ? "green" : "red"}`}>
              {wsConnected ? "Connected" : "Disconnected"}
            </div>
          </div>
          <div className="s-card">
            <div className="s-card-label">F1 Account</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className={`s-badge ${auth.loggedIn ? "green" : auth.pending ? "amber" : "red"}`}>
                {auth.pending ? "Logging in..." : auth.loggedIn ? "Logged in" : "Not logged in"}
              </div>
              {auth.loggedIn
                ? <button className="s-btn s-btn-danger" onClick={logout}>Logout</button>
                : <button className="s-btn" onClick={login} disabled={auth.pending}>
                    {auth.pending ? "Opening browser..." : "Login with F1"}
                  </button>
              }
            </div>
            {auth.expiresAt && (
              <div className="s-hint">Token expires {new Date(auth.expiresAt).toLocaleDateString()}</div>
            )}
          </div>
          <div className="s-card">
            <div className="s-card-label">Session Mode</div>
            <div className={`s-badge ${status?.mode === "idle" ? "dim" : status?.mode === "live" ? "green" : "blue"}`}>
              {status?.mode ?? "idle"}
            </div>
          </div>
          <div className="s-card">
            <div className="s-card-label">F1 Streaming</div>
            <div className={`s-badge ${streamingStatus === "Available" ? "green" : streamingStatus == null ? "dim" : "red"}`}>
              {streamingStatus ?? "Unknown"}
            </div>
          </div>
        </div>
      </div>

      {/* Event tracker */}
      {eventTracker?.seasonContext?.timetables && (
        <div className="section">
          <div className="section-label">
            Current Event
            {eventTracker.race?.meetingName && <span className="s-section-sub"> — {eventTracker.race.meetingName}</span>}
          </div>
          <div className="s-timetable">
            {eventTracker.seasonContext.timetables.map((t, i) => {
              const start = new Date(`${t.startTime}${t.gmtOffset}`);
              return (
                <div key={i} className={`s-timetable-row ${t.state}`}>
                  <span className={`s-badge ${t.state === "live" ? "green" : t.state === "completed" ? "dim" : "blue"}`} style={{ minWidth: 80, justifyContent: "center" }}>
                    {t.state}
                  </span>
                  <span className="s-timetable-label">{t.description}</span>
                  <span className="s-timetable-time">{start.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live control */}
      <div className="section">
        <div className="section-label">Live Session</div>
        <div className="s-panel">
          <p className="s-panel-desc">Connect to F1 SignalR for the current live session. Requires an active race weekend and a valid F1 account.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {status?.mode === "live"
              ? <button className="s-btn s-btn-danger" onClick={disconnectLive}>Disconnect</button>
              : <button className="s-btn s-btn-primary" onClick={connectLive} disabled={!auth.loggedIn}>
                  Connect Live
                </button>
            }
          </div>
        </div>
      </div>

      {/* Playback controls — shown when session is loaded */}
      {status && status.mode === "playback" && (
        <div className="section">
          <div className="section-label">Playback</div>
          <div className="s-panel">
            <div className="s-session-path">{status.sessionPath ? formatSessionPath(status.sessionPath) : ""}</div>

            {/* Progress bar */}
            <div className="s-progress-track">
              <div className="s-progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <div className="s-time-row">
              <span>{fmtMs(status.offsetMs)}</span>
              <span>{fmtMs(status.durationMs)}</span>
            </div>

            {/* Controls */}
            <div className="s-controls">
              {status.playing
                ? <button className="s-btn s-btn-primary" onClick={pause}>⏸ Pause</button>
                : <button className="s-btn s-btn-primary" onClick={() => play(1)}>▶ Play</button>
              }
              <button className="s-btn" onClick={() => play(2)} title="2× speed">2×</button>
              <button className="s-btn" onClick={() => play(4)} title="4× speed">4×</button>
              <button className="s-btn" onClick={() => play(8)} title="8× speed">8×</button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast delay */}
      <div className="section">
        <div className="section-label">Broadcast Delay</div>
        <div className="s-panel">
          <p className="s-panel-desc">Delay the data stream to sync with your TV broadcast. Current: <strong>{delay / 1000}s</strong></p>
          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
            <input
              type="number"
              className="s-input"
              value={delayInput}
              min={0}
              max={120000}
              step={1000}
              onChange={e => setDelayInput(e.target.value)}
              placeholder="ms"
            />
            <span style={{ fontSize: 11, color: "var(--text3)" }}>ms</span>
            <button className="s-btn s-btn-primary" onClick={applyDelay}>Apply</button>
            {[0, 15000, 30000, 45000, 60000].map(ms => (
              <button key={ms} className="s-btn" onClick={() => { setDelayInput(String(ms)); }}>
                {ms === 0 ? "Live" : `${ms / 1000}s`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Raw data feed */}
      {(status?.mode === "live" || status?.mode === "playback") && (
        <div className="section">
          <div className="section-label">Raw Data Feed</div>
          <div className="s-panel" style={{ padding: 0 }}>
            <div className="s-feed-toolbar">
              <input
                className="s-input"
                placeholder="Filter by topic..."
                value={feedFilter}
                onChange={e => setFeedFilter(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="s-btn" onClick={() => setFeedPaused(p => !p)}>
                {feedPaused ? "▶ Resume" : "⏸ Pause"}
              </button>
              <button className="s-btn" onClick={() => setFeed([])}>Clear</button>
              <span className="s-feed-count">{filteredFeed.length} msgs</span>
            </div>
            <div className="s-feed-log">
              {filteredFeed.map((entry, i) => (
                <div key={i} className="s-feed-entry">
                  <span className="s-feed-ts">{new Date(entry.ts).toISOString().slice(11, 23)}</span>
                  <span className="s-feed-topic">{entry.topic}</span>
                  <span className="s-feed-data">{JSON.stringify(entry.data)}</span>
                </div>
              ))}
              <div ref={feedEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* Session browser */}
      <div className="section">
        <div className="section-label">Session Browser</div>

        {/* Cached sessions */}
        {cached.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 8 }}>Cached on disk</div>
            <div className="s-cached-list">
              {cached.map(s => (
                <div key={s.sessionPath} className="s-cached-item">
                  <span className="s-cached-path">{formatSessionPath(s.sessionPath)}</span>
                  <span className="s-cached-size">{fmtBytes(s.sizeBytes)}</span>
                  <button
                    className="s-btn s-btn-sm"
                    disabled={loadingSession === s.sessionPath}
                    onClick={() => loadSession(s.sessionPath)}
                  >
                    {loadingSession === s.sessionPath ? "Loading..." : "Load"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Season index */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
          <input
            type="number"
            className="s-input"
            value={year}
            min={2018}
            max={new Date().getFullYear()}
            onChange={e => setYear(parseInt(e.target.value))}
            style={{ width: 80 }}
          />
          <button className="s-btn s-btn-primary" onClick={loadIndex} disabled={loadingIndex}>
            {loadingIndex ? "Loading..." : "Browse Sessions"}
          </button>
        </div>

        {meetings.length > 0 && (
          <div className="s-meetings">
            {meetings.map(m => (
              <div key={m.key} className="s-meeting">
                <button
                  className="s-meeting-header"
                  onClick={() => setExpandedMeeting(expandedMeeting === m.key ? null : m.key)}
                >
                  <span>{m.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text3)" }}>{m.location}</span>
                  <span className="s-meeting-chevron">{expandedMeeting === m.key ? "▲" : "▼"}</span>
                </button>
                {expandedMeeting === m.key && (
                  <div className="s-sessions-list">
                    {m.sessions.map(s => (
                      <div key={s.path} className="s-session-item">
                        <span className="s-session-name">{s.name}</span>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text3)" }}>{s.path}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {s.cached && <span className="s-badge green" style={{ fontSize: 10 }}>cached</span>}
                          <button
                            className="s-btn s-btn-sm"
                            disabled={loadingSession === s.path}
                            onClick={() => loadSession(s.path)}
                          >
                            {loadingSession === s.path ? "Fetching..." : s.cached ? "Load" : "Fetch & Load"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
