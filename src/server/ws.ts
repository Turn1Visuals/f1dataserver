import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { sessionManager } from "../f1/session-manager.js";

let wss: WebSocketServer | null = null;

function broadcast(msg: unknown): void {
  if (!wss) return;
  const payload = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function sendSnapshot(ws: WebSocket): void {
  const snapshot = sessionManager.getSnapshot();
  if (Object.keys(snapshot).length > 0) {
    ws.send(JSON.stringify({ type: "snapshot", state: snapshot }));
  }
}

export function initWss(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: "/f1" });

  wss.on("connection", (ws) => {
    console.log("[f1/ws] Client connected");

    // Send current status
    ws.send(JSON.stringify({ type: "status", ...sessionManager.getStatus() }));

    // Send current state snapshot immediately
    sendSnapshot(ws);

    // Send circuit layout if already loaded
    const circuit = sessionManager.getCircuit();
    if (circuit) ws.send(JSON.stringify({ type: "circuit", data: circuit }));

    ws.on("close", () => console.log("[f1/ws] Client disconnected"));
    ws.on("error", (err) => console.error("[f1/ws] Client error:", err.message));
  });

  // Forward session manager events to all clients
  sessionManager.on("message", ({ topic, data }: { topic: string; data: unknown }) => {
    broadcast({ type: "data", topic, data });
  });

  sessionManager.on("snapshotReady", () => {
    // New snapshot available — push to all clients
    broadcast({ type: "snapshot", state: sessionManager.getSnapshot() });
  });

  sessionManager.on("statusChanged", () => {
    broadcast({ type: "status", ...sessionManager.getStatus() });
  });

  sessionManager.on("connected", () => {
    broadcast({ type: "status", ...sessionManager.getStatus() });
  });

  sessionManager.on("disconnected", () => {
    broadcast({ type: "status", ...sessionManager.getStatus() });
    broadcast({ type: "liveDisconnected" });
  });

  sessionManager.on("ended", () => {
    broadcast({ type: "status", ...sessionManager.getStatus() });
    broadcast({ type: "ended" });
  });

  sessionManager.on("circuit", (data: unknown) => {
    broadcast({ type: "circuit", data });
  });

  sessionManager.on("error", (err: Error) => {
    broadcast({ type: "error", message: err.message });
  });

  console.log("[f1/ws] WebSocket server ready on ws://localhost/f1");
  return wss;
}
