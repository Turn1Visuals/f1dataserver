import { EventEmitter } from "events";
import { inflateRaw } from "zlib";
import { promisify } from "util";
import { LiveFeed, type FeedEvent } from "./livefeed.js";
import { fetchSeasonIndex, fetchTopic, TOPICS, type TimelineEvent, type Meeting } from "./fetch.js";
import { isCached, writeCache, readCache, appendCache, listCached, type CachedSession } from "./cache.js";
import { getCircuitLayout } from "./circuits.js";

const inflateRawAsync = promisify(inflateRaw);

export type SessionMode = "idle" | "live" | "playback";

export interface SessionStatus {
  mode: SessionMode;
  sessionPath: string | null;
  playing: boolean;
  offsetMs: number;
  durationMs: number;
  speed: number;
  delayMs: number;
  snapshotReady: boolean;
}

interface DelayedMessage {
  receiveTime: number;
  topic: string;
  data: unknown;
}

function deepMerge(target: unknown, source: unknown): unknown {
  if (source === null || typeof source !== "object" || Array.isArray(source)) return source;
  if (target === null || typeof target !== "object" || Array.isArray(target)) target = {};
  const t = target as Record<string, unknown>;
  const s = source as Record<string, unknown>;
  for (const [key, val] of Object.entries(s)) {
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      t[key] = deepMerge(t[key] ?? {}, val);
    } else {
      t[key] = val;
    }
  }
  return t;
}

async function decompress(b64: string): Promise<unknown> {
  const buf = Buffer.from(b64, "base64");
  const raw = await inflateRawAsync(buf);
  return JSON.parse(raw.toString("utf-8"));
}

async function parseData(data: unknown): Promise<unknown> {
  if (typeof data === "string") return decompress(data);
  return data;
}

export class SessionManager extends EventEmitter {
  private mode: SessionMode = "idle";
  private sessionPath: string | null = null;

  // Live
  private liveFeed: LiveFeed | null = null;
  private _liveToken: string | null = null;
  private _liveConnected = false;   // true once subscribed + snapshot received
  private _connectAborted = false;

  // Playback
  private timeline: TimelineEvent[] = [];
  private playbackIndex = 0;
  private playbackOffset = 0;
  private playbackSpeed = 1;
  private playbackStartWall = 0;
  private playbackStartOffset = 0;
  private playbackTimer: NodeJS.Timeout | null = null;
  private isPlaying = false;

  // State snapshot (tracks current merged state per topic)
  private liveState: Record<string, unknown> = {};
  private delayedState: Record<string, unknown> = {};

  // Circuit layout
  private circuitLayout: unknown = null;
  private _circuitFetched = false;

  // Delay buffer
  private delayMs = 0;
  private delayBuffer: DelayedMessage[] = [];
  private delayTimer: NodeJS.Timeout | null = null;

  // ── Public API ──────────────────────────────────────────────────────────────

  async connectLive(token: string): Promise<void> {
    this._reset();
    this._liveToken = token;
    this._connectAborted = false;
    this.mode = "live";
    this.sessionPath = "live";
    if (this.delayMs > 0) this._startDelayTimer();
    await this._attemptLiveConnect();
  }

  private async _attemptLiveConnect(): Promise<void> {
    if (this._connectAborted) return;

    this._liveConnected = false;
    this.liveFeed = new LiveFeed(this._liveToken!);

    this.liveFeed.on("data", ({ topic, data }: FeedEvent) => {
      parseData(data).then((parsed) => {
        this.liveState[topic] = deepMerge(this.liveState[topic] ?? {}, parsed);
        this._maybeLoadCircuit(topic, parsed);
      }).catch(() => {});

      if (this.delayMs === 0) {
        this.delayedState[topic] = this.liveState[topic];
        this.emit("message", { topic, data });
      } else {
        this.delayBuffer.push({ receiveTime: Date.now(), topic, data });
      }
    });

    this.liveFeed.on("snapshot", () => {
      this.emit("snapshotReady");
    });

    this.liveFeed.on("connected", () => {
      this._liveConnected = true;
      console.log("[f1/session] Live connected");
      this.emit("connected");
    });

    this.liveFeed.on("disconnected", () => {
      if (!this._liveConnected && !this._connectAborted) {
        // Dropped before subscribing — retry immediately
        console.log("[f1/session] Dropped before subscribing — retrying...");
        this.liveFeed = null;
        this._attemptLiveConnect().catch((err: Error) => this.emit("error", err));
      } else if (!this._connectAborted) {
        console.log("[f1/session] Live disconnected");
        this.mode = "idle";
        this.emit("disconnected");
      }
    });

    this.liveFeed.on("error", (err: Error) => {
      this.emit("error", err);
    });

    await this.liveFeed.connect();
  }

  async loadSession(sessionPath: string): Promise<{ events: number; durationMs: number }> {
    this._reset();
    this.mode = "playback";
    this.sessionPath = sessionPath;

    let timeline: TimelineEvent[];

    if (isCached(sessionPath)) {
      console.log(`[f1/session] Loading from cache: ${sessionPath}`);
      timeline = readCache(sessionPath);
    } else {
      console.log(`[f1/session] Fetching session: ${sessionPath}`);
      const results = await Promise.all(
        TOPICS.map(async (topic) => ({
          topic,
          entries: await fetchTopic(sessionPath, topic),
        }))
      );
      timeline = [];
      for (const { topic, entries } of results) {
        for (const { offset, data } of entries) {
          timeline.push({ offset, topic: topic as TimelineEvent["topic"], data });
        }
      }
      timeline.sort((a, b) => a.offset - b.offset);
      console.log(`[f1/session] Fetched ${timeline.length} events — caching...`);
      writeCache(sessionPath, timeline);
    }

    this.timeline = timeline;
    this.playbackOffset = 0;
    this.playbackIndex = 0;

    // Build initial state snapshot
    this.liveState = {};
    for (const event of timeline) {
      await parseData(event.data).then((parsed) => {
        this.liveState[event.topic] = deepMerge(this.liveState[event.topic] ?? {}, parsed);
        this._maybeLoadCircuit(event.topic, parsed);
      }).catch(() => {});
    }
    this.delayedState = { ...this.liveState };

    const durationMs = timeline.length > 0 ? (timeline[timeline.length - 1]?.offset ?? 0) : 0;
    return { events: timeline.length, durationMs };
  }

  play(speed = 1): void {
    if (this.mode !== "playback" || this.isPlaying) return;
    this.playbackSpeed = speed;
    this.playbackStartWall = Date.now();
    this.playbackStartOffset = this.playbackOffset;
    this.isPlaying = true;

    // Find starting index
    this.playbackIndex = this.timeline.findIndex((e) => e.offset >= this.playbackOffset);
    if (this.playbackIndex === -1) this.playbackIndex = this.timeline.length;

    this.playbackTimer = setInterval(() => this._playbackTick(), 50);
    console.log(`[f1/session] Playback started at speed ${speed}x`);
  }

  pause(): void {
    if (!this.isPlaying) return;
    this.playbackOffset =
      this.playbackStartOffset +
      (Date.now() - this.playbackStartWall) * this.playbackSpeed;
    this.isPlaying = false;
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
    console.log("[f1/session] Playback paused");
  }

  async seek(offsetMs: number): Promise<void> {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) this.pause();

    this.playbackOffset = Math.max(0, offsetMs);
    this.playbackIndex = this.timeline.findIndex((e) => e.offset >= this.playbackOffset);
    if (this.playbackIndex === -1) this.playbackIndex = this.timeline.length;

    // Rebuild state up to seek point
    this.liveState = {};
    for (const event of this.timeline.slice(0, this.playbackIndex)) {
      await parseData(event.data).then((parsed) => {
        this.liveState[event.topic] = deepMerge(this.liveState[event.topic] ?? {}, parsed);
      }).catch(() => {});
    }
    this.delayedState = { ...this.liveState };
    this.emit("snapshotReady");

    if (wasPlaying) this.play(this.playbackSpeed);
  }

  disconnectLive(): void {
    this._connectAborted = true;
    this.liveFeed?.disconnect();
    this.liveFeed = null;
    this.mode = "idle";
  }

  setDelay(ms: number): void {
    this.delayMs = Math.max(0, ms);
    // Clear buffer on delay change
    this.delayBuffer = [];
    if (this.delayMs === 0) {
      if (this.delayTimer) { clearInterval(this.delayTimer); this.delayTimer = null; }
    } else if (this.mode === "live" && !this.delayTimer) {
      this._startDelayTimer();
    }
    console.log(`[f1/session] Delay set to ${this.delayMs}ms`);
  }

  getDelay(): number { return this.delayMs; }

  getStatus(): SessionStatus {
    const durationMs =
      this.timeline.length > 0 ? (this.timeline[this.timeline.length - 1]?.offset ?? 0) : 0;
    const currentOffset = this.isPlaying
      ? this.playbackStartOffset + (Date.now() - this.playbackStartWall) * this.playbackSpeed
      : this.playbackOffset;

    return {
      mode: this.mode,
      sessionPath: this.sessionPath,
      playing: this.isPlaying,
      offsetMs: Math.round(currentOffset),
      durationMs,
      speed: this.playbackSpeed,
      delayMs: this.delayMs,
      snapshotReady: Object.keys(this.liveState).length > 0,
    };
  }

  getSnapshot(): Record<string, unknown> {
    return this.delayedState;
  }

  getCircuit(): unknown {
    return this.circuitLayout;
  }

  // ── Session index ────────────────────────────────────────────────────────────

  async getSeasonIndex(year: number): Promise<Meeting[]> {
    return fetchSeasonIndex(year);
  }

  getCachedSessions(): CachedSession[] {
    return listCached();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private _reset(): void {
    this._connectAborted = true;
    this._circuitFetched = false;
    this.circuitLayout = null;
    this.pause();
    this.liveFeed?.disconnect();
    this.liveFeed = null;
    if (this.delayTimer) { clearInterval(this.delayTimer); this.delayTimer = null; }
    this.timeline = [];
    this.liveState = {};
    this.delayedState = {};
    this.delayBuffer = [];
    this.playbackOffset = 0;
    this.playbackIndex = 0;
    this.mode = "idle";
    this.sessionPath = null;
  }

  private _playbackTick(): void {
    const currentOffset =
      this.playbackStartOffset + (Date.now() - this.playbackStartWall) * this.playbackSpeed;
    this.playbackOffset = currentOffset;

    // Emit all events up to current offset
    while (
      this.playbackIndex < this.timeline.length &&
      (this.timeline[this.playbackIndex]?.offset ?? Infinity) <= currentOffset
    ) {
      const event = this.timeline[this.playbackIndex]!;
      this.emit("message", { topic: event.topic, data: event.data });
      this.playbackIndex++;
    }

    // End of session
    if (this.playbackIndex >= this.timeline.length) {
      this.pause();
      this.emit("ended");
    }
  }

  private _maybeLoadCircuit(topic: string, data: unknown): void {
    if (topic !== "SessionInfo" || this._circuitFetched) return;
    const si = data as { Meeting?: { Circuit?: { Key?: number | string } }; StartDate?: string } | null;
    const key    = si?.Meeting?.Circuit?.Key;
    const season = si?.StartDate?.slice(0, 4);
    if (!key || !season) return;
    this._circuitFetched = true;
    getCircuitLayout(key, season)
      .then((layout) => {
        this.circuitLayout = layout;
        this.emit("circuit", layout);
        console.log(`[f1/session] Circuit layout ready: key=${key} season=${season}`);
      })
      .catch((err: Error) => {
        console.warn(`[f1/session] Circuit layout fetch failed: ${err.message}`);
      });
  }

  private _startDelayTimer(): void {
    this.delayTimer = setInterval(() => {
      const cutoff = Date.now() - this.delayMs;
      while (this.delayBuffer.length > 0 && this.delayBuffer[0]!.receiveTime <= cutoff) {
        const { topic, data } = this.delayBuffer.shift()!;
        this.delayedState[topic] = this.liveState[topic];
        this.emit("message", { topic, data });
      }
    }, 50);
  }
}

export const sessionManager = new SessionManager();
