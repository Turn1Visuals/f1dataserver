import { EventEmitter } from "events";
import WebSocket from "ws";
const HUB_URL = "https://livetiming.formula1.com/signalrcore";
const BASE_HEADERS = { "User-Agent": "BestHTTP", "Accept-Encoding": "gzip, identity" };
const TOPICS = [
    "Heartbeat", "AudioStreams", "DriverList", "ExtrapolatedClock",
    "RaceControlMessages", "SessionInfo", "SessionStatus", "TeamRadio",
    "TimingAppData", "TimingStats", "TrackStatus", "WeatherData",
    "Position.z", "CarData.z", "ContentStreams", "SessionData",
    "TimingData", "TopThree", "RcmSeries", "LapCount",
];
export class LiveFeed extends EventEmitter {
    ws = null;
    token;
    constructor(token) {
        super();
        this.token = token;
    }
    async connect() {
        console.log("[f1/live] Negotiating SignalR connection...");
        const connectionToken = await this._negotiate();
        console.log("[f1/live] Connecting WebSocket...");
        await this._connectWs(connectionToken);
    }
    disconnect() {
        this.ws?.close();
        this.ws = null;
    }
    async _negotiate() {
        const headers = { ...BASE_HEADERS, Authorization: `Bearer ${this.token}` };
        const res = await fetch(`${HUB_URL}/negotiate?negotiateVersion=1`, {
            method: "POST",
            headers,
        });
        if (!res.ok)
            throw new Error(`Negotiate failed: ${res.status} ${await res.text()}`);
        const body = await res.json();
        const token = body.connectionToken ?? body.connectionId;
        if (!token)
            throw new Error("No connectionToken in negotiate response");
        return token;
    }
    _connectWs(connectionToken) {
        return new Promise((resolve, reject) => {
            const qs = new URLSearchParams({ id: connectionToken });
            const wsUrl = `${HUB_URL.replace("https://", "wss://")}?${qs}`;
            const headers = { ...BASE_HEADERS, Authorization: `Bearer ${this.token}` };
            this.ws = new WebSocket(wsUrl, { headers });
            this.ws.once("open", () => {
                this._handshake();
                resolve();
            });
            this.ws.once("error", (err) => {
                const msg = err.message?.includes("404") ? "No active F1 session" : err.message;
                reject(new Error(msg));
                this.emit("error", new Error(msg));
            });
            this.ws.on("message", (raw) => this._onMessage(raw.toString()));
            this.ws.on("close", () => this.emit("disconnected"));
            this.ws.on("error", (err) => this.emit("error", err));
        });
    }
    _handshake() {
        this.ws?.send(JSON.stringify({ protocol: "json", version: 1 }) + "\x1e");
    }
    _subscribe() {
        const msg = JSON.stringify({
            type: 1,
            invocationId: "0",
            target: "Subscribe",
            arguments: [TOPICS],
        }) + "\x1e";
        this.ws?.send(msg);
        console.log(`[f1/live] Subscribed to ${TOPICS.length} topics`);
    }
    _msgCount = 0;
    _onMessage(raw) {
        const parts = raw.split("\x1e").filter(Boolean);
        for (const part of parts) {
            let msg;
            try {
                msg = JSON.parse(part);
            }
            catch {
                continue;
            }
            if (msg.type === 1 && msg.target === "feed" && Array.isArray(msg.arguments)) {
                const [topic, data] = msg.arguments;
                if (topic && data != null) {
                    this._msgCount++;
                    if (this._msgCount <= 10 || this._msgCount % 50 === 0) {
                        console.log(`[f1/live] msg #${this._msgCount} topic=${topic}`);
                    }
                    this.emit("data", { topic, data });
                }
            }
            else if (msg.type === 3 && msg.invocationId === "0") {
                // Full state snapshot for all topics on initial subscribe
                const result = msg.result;
                if (result && typeof result === "object") {
                    const topics = Object.entries(result).filter(([, d]) => d != null);
                    console.log(`[f1/live] Snapshot received — ${topics.length} topics with data: ${topics.map(([t]) => t).join(", ")}`);
                    for (const [topic, data] of topics) {
                        this.emit("data", { topic, data });
                    }
                    this.emit("snapshot");
                }
                else {
                    console.log("[f1/live] Snapshot received — no data (no active session)");
                }
            }
            else if (msg.type === 6) {
                console.log("[f1/live] Heartbeat ♥");
                this.ws?.send(JSON.stringify({ type: 6 }) + "\x1e");
            }
            else if (msg.type === 7) {
                this.emit("disconnected");
            }
            else if (!msg.type) {
                if (msg.error) {
                    this.emit("error", new Error("Handshake error: " + String(msg.error)));
                    return;
                }
                this._subscribe();
                this.emit("connected");
            }
        }
    }
}
//# sourceMappingURL=livefeed.js.map