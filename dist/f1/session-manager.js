import { EventEmitter } from "events";
import { inflateRaw } from "zlib";
import { promisify } from "util";
import { LiveFeed } from "./livefeed.js";
import { fetchSeasonIndex, fetchTopic, TOPICS } from "./fetch.js";
import { isCached, writeCache, readCache, appendCache, listCached } from "./cache.js";
import { getCircuitLayout } from "./circuits.js";
const inflateRawAsync = promisify(inflateRaw);
function deepMerge(target, source) {
    if (source === null || typeof source !== "object" || Array.isArray(source))
        return source;
    if (target === null || typeof target !== "object" || Array.isArray(target))
        target = {};
    const t = target;
    const s = source;
    for (const [key, val] of Object.entries(s)) {
        if (val !== null && typeof val === "object" && !Array.isArray(val)) {
            t[key] = deepMerge(t[key] ?? {}, val);
        }
        else {
            t[key] = val;
        }
    }
    return t;
}
async function decompress(b64) {
    const buf = Buffer.from(b64, "base64");
    const raw = await inflateRawAsync(buf);
    return JSON.parse(raw.toString("utf-8"));
}
async function parseData(data) {
    if (typeof data === "string")
        return decompress(data);
    return data;
}
export class SessionManager extends EventEmitter {
    mode = "idle";
    sessionPath = null;
    // Live
    liveFeed = null;
    _liveToken = null;
    _liveConnected = false; // true once subscribed + snapshot received
    _connectAborted = false;
    // Playback
    timeline = [];
    playbackIndex = 0;
    playbackOffset = 0;
    playbackSpeed = 1;
    playbackStartWall = 0;
    playbackStartOffset = 0;
    playbackTimer = null;
    isPlaying = false;
    // State snapshot (tracks current merged state per topic)
    liveState = {};
    delayedState = {};
    // Circuit layout
    circuitLayout = null;
    _circuitFetched = false;
    // Delay buffer
    delayMs = 0;
    delayBuffer = [];
    delayTimer = null;
    // ── Public API ──────────────────────────────────────────────────────────────
    async connectLive(token) {
        this._reset();
        this._liveToken = token;
        this._connectAborted = false;
        this.mode = "live";
        this.sessionPath = "live";
        if (this.delayMs > 0)
            this._startDelayTimer();
        await this._attemptLiveConnect();
    }
    async _attemptLiveConnect() {
        if (this._connectAborted)
            return;
        this._liveConnected = false;
        this.liveFeed = new LiveFeed(this._liveToken);
        this.liveFeed.on("data", ({ topic, data }) => {
            parseData(data).then((parsed) => {
                this.liveState[topic] = deepMerge(this.liveState[topic] ?? {}, parsed);
                this._maybeLoadCircuit(topic, parsed);
            }).catch(() => { });
            if (this.delayMs === 0) {
                this.delayedState[topic] = this.liveState[topic];
                this.emit("message", { topic, data });
            }
            else {
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
                this._attemptLiveConnect().catch((err) => this.emit("error", err));
            }
            else if (!this._connectAborted) {
                console.log("[f1/session] Live disconnected");
                this.mode = "idle";
                this.emit("disconnected");
            }
        });
        this.liveFeed.on("error", (err) => {
            this.emit("error", err);
        });
        await this.liveFeed.connect();
    }
    async loadSession(sessionPath) {
        this._reset();
        this.mode = "playback";
        this.sessionPath = sessionPath;
        let timeline;
        if (isCached(sessionPath)) {
            console.log(`[f1/session] Loading from cache: ${sessionPath}`);
            timeline = readCache(sessionPath);
        }
        else {
            console.log(`[f1/session] Fetching session: ${sessionPath}`);
            const results = await Promise.all(TOPICS.map(async (topic) => ({
                topic,
                entries: await fetchTopic(sessionPath, topic),
            })));
            timeline = [];
            for (const { topic, entries } of results) {
                for (const { offset, data } of entries) {
                    timeline.push({ offset, topic: topic, data });
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
            }).catch(() => { });
        }
        this.delayedState = { ...this.liveState };
        const durationMs = timeline.length > 0 ? (timeline[timeline.length - 1]?.offset ?? 0) : 0;
        return { events: timeline.length, durationMs };
    }
    play(speed = 1) {
        if (this.mode !== "playback" || this.isPlaying)
            return;
        this.playbackSpeed = speed;
        this.playbackStartWall = Date.now();
        this.playbackStartOffset = this.playbackOffset;
        this.isPlaying = true;
        // Find starting index
        this.playbackIndex = this.timeline.findIndex((e) => e.offset >= this.playbackOffset);
        if (this.playbackIndex === -1)
            this.playbackIndex = this.timeline.length;
        this.playbackTimer = setInterval(() => this._playbackTick(), 50);
        console.log(`[f1/session] Playback started at speed ${speed}x`);
    }
    pause() {
        if (!this.isPlaying)
            return;
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
    async seek(offsetMs) {
        const wasPlaying = this.isPlaying;
        if (wasPlaying)
            this.pause();
        this.playbackOffset = Math.max(0, offsetMs);
        this.playbackIndex = this.timeline.findIndex((e) => e.offset >= this.playbackOffset);
        if (this.playbackIndex === -1)
            this.playbackIndex = this.timeline.length;
        // Rebuild state up to seek point
        this.liveState = {};
        for (const event of this.timeline.slice(0, this.playbackIndex)) {
            await parseData(event.data).then((parsed) => {
                this.liveState[event.topic] = deepMerge(this.liveState[event.topic] ?? {}, parsed);
            }).catch(() => { });
        }
        this.delayedState = { ...this.liveState };
        this.emit("snapshotReady");
        if (wasPlaying)
            this.play(this.playbackSpeed);
    }
    disconnectLive() {
        this._connectAborted = true;
        this.liveFeed?.disconnect();
        this.liveFeed = null;
        this.mode = "idle";
    }
    setDelay(ms) {
        this.delayMs = Math.max(0, ms);
        // Clear buffer on delay change
        this.delayBuffer = [];
        if (this.delayMs === 0) {
            if (this.delayTimer) {
                clearInterval(this.delayTimer);
                this.delayTimer = null;
            }
        }
        else if (this.mode === "live" && !this.delayTimer) {
            this._startDelayTimer();
        }
        console.log(`[f1/session] Delay set to ${this.delayMs}ms`);
    }
    getDelay() { return this.delayMs; }
    getStatus() {
        const durationMs = this.timeline.length > 0 ? (this.timeline[this.timeline.length - 1]?.offset ?? 0) : 0;
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
    getSnapshot() {
        return this.delayedState;
    }
    getCircuit() {
        return this.circuitLayout;
    }
    // ── Session index ────────────────────────────────────────────────────────────
    async getSeasonIndex(year) {
        return fetchSeasonIndex(year);
    }
    getCachedSessions() {
        return listCached();
    }
    // ── Private ──────────────────────────────────────────────────────────────────
    _reset() {
        this._connectAborted = true;
        this._circuitFetched = false;
        this.circuitLayout = null;
        this.pause();
        this.liveFeed?.disconnect();
        this.liveFeed = null;
        if (this.delayTimer) {
            clearInterval(this.delayTimer);
            this.delayTimer = null;
        }
        this.timeline = [];
        this.liveState = {};
        this.delayedState = {};
        this.delayBuffer = [];
        this.playbackOffset = 0;
        this.playbackIndex = 0;
        this.mode = "idle";
        this.sessionPath = null;
    }
    _playbackTick() {
        const currentOffset = this.playbackStartOffset + (Date.now() - this.playbackStartWall) * this.playbackSpeed;
        this.playbackOffset = currentOffset;
        // Emit all events up to current offset
        while (this.playbackIndex < this.timeline.length &&
            (this.timeline[this.playbackIndex]?.offset ?? Infinity) <= currentOffset) {
            const event = this.timeline[this.playbackIndex];
            this.emit("message", { topic: event.topic, data: event.data });
            this.playbackIndex++;
        }
        // End of session
        if (this.playbackIndex >= this.timeline.length) {
            this.pause();
            this.emit("ended");
        }
    }
    _maybeLoadCircuit(topic, data) {
        if (topic !== "SessionInfo" || this._circuitFetched)
            return;
        const si = data;
        const key = si?.Meeting?.Circuit?.Key;
        const season = si?.StartDate?.slice(0, 4);
        if (!key || !season)
            return;
        this._circuitFetched = true;
        getCircuitLayout(key, season)
            .then((layout) => {
            this.circuitLayout = layout;
            this.emit("circuit", layout);
            console.log(`[f1/session] Circuit layout ready: key=${key} season=${season}`);
        })
            .catch((err) => {
            console.warn(`[f1/session] Circuit layout fetch failed: ${err.message}`);
        });
    }
    _startDelayTimer() {
        this.delayTimer = setInterval(() => {
            const cutoff = Date.now() - this.delayMs;
            while (this.delayBuffer.length > 0 && this.delayBuffer[0].receiveTime <= cutoff) {
                const { topic, data } = this.delayBuffer.shift();
                this.delayedState[topic] = this.liveState[topic];
                this.emit("message", { topic, data });
            }
        }, 50);
    }
}
export const sessionManager = new SessionManager();
//# sourceMappingURL=session-manager.js.map