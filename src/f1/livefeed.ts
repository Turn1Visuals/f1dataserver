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

export interface FeedEvent {
  topic: string;
  data: unknown;
}

export class LiveFeed extends EventEmitter {
  private ws: WebSocket | null = null;
  private token: string;

  constructor(token: string) {
    super();
    this.token = token;
  }

  async connect(): Promise<void> {
    console.log("[f1/live] Negotiating SignalR connection...");
    const connectionToken = await this._negotiate();
    console.log("[f1/live] Connecting WebSocket...");
    await this._connectWs(connectionToken);
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  private async _negotiate(): Promise<string> {
    const headers = { ...BASE_HEADERS, Authorization: `Bearer ${this.token}` };
    const res = await fetch(`${HUB_URL}/negotiate?negotiateVersion=1`, {
      method: "POST",
      headers,
    });
    if (!res.ok) throw new Error(`Negotiate failed: ${res.status} ${await res.text()}`);
    const body = await res.json() as { connectionToken?: string; connectionId?: string };
    const token = body.connectionToken ?? body.connectionId;
    if (!token) throw new Error("No connectionToken in negotiate response");
    return token;
  }

  private _connectWs(connectionToken: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const qs = new URLSearchParams({ id: connectionToken });
      const wsUrl = `${HUB_URL.replace("https://", "wss://")}?${qs}`;
      const headers = { ...BASE_HEADERS, Authorization: `Bearer ${this.token}` };

      this.ws = new WebSocket(wsUrl, { headers });

      this.ws.once("open", () => {
        this._handshake();
        resolve();
      });
      this.ws.once("error", (err: Error) => {
        const msg = err.message?.includes("404") ? "No active F1 session" : err.message;
        reject(new Error(msg));
        this.emit("error", new Error(msg));
      });
      this.ws.on("message", (raw) => this._onMessage(raw.toString()));
      this.ws.on("close", () => this.emit("disconnected"));
      this.ws.on("error", (err) => this.emit("error", err));
    });
  }

  private _handshake(): void {
    this.ws?.send(JSON.stringify({ protocol: "json", version: 1 }) + "\x1e");
  }

  private _subscribe(): void {
    const msg =
      JSON.stringify({
        type: 1,
        invocationId: "0",
        target: "Subscribe",
        arguments: [TOPICS],
      }) + "\x1e";
    this.ws?.send(msg);
    console.log(`[f1/live] Subscribed to ${TOPICS.length} topics`);
  }

  private _msgCount = 0;

  private _onMessage(raw: string): void {
    const parts = raw.split("\x1e").filter(Boolean);
    for (const part of parts) {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(part) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (msg.type === 1 && msg.target === "feed" && Array.isArray(msg.arguments)) {
        const [topic, data] = msg.arguments as [string, unknown];
        if (topic && data != null) {
          this._msgCount++;
          if (this._msgCount <= 10 || this._msgCount % 50 === 0) {
            console.log(`[f1/live] msg #${this._msgCount} topic=${topic}`);
          }
          this.emit("data", { topic, data } satisfies FeedEvent);
        }
      } else if (msg.type === 3 && msg.invocationId === "0") {
        // Full state snapshot for all topics on initial subscribe
        const result = msg.result;
        if (result && typeof result === "object") {
          const topics = Object.entries(result as Record<string, unknown>).filter(([, d]) => d != null);
          console.log(`[f1/live] Snapshot received — ${topics.length} topics with data: ${topics.map(([t]) => t).join(", ")}`);
          for (const [topic, data] of topics) {
            this.emit("data", { topic, data } satisfies FeedEvent);
          }
          this.emit("snapshot");
        } else {
          console.log("[f1/live] Snapshot received — no data (no active session)");
        }
      } else if (msg.type === 6) {
        console.log("[f1/live] Heartbeat ♥");
        this.ws?.send(JSON.stringify({ type: 6 }) + "\x1e");
      } else if (msg.type === 7) {
        this.emit("disconnected");
      } else if (!msg.type) {
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
