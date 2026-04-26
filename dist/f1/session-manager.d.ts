import { EventEmitter } from "events";
import { type Meeting } from "./fetch.js";
import { type CachedSession } from "./cache.js";
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
export declare class SessionManager extends EventEmitter {
    private mode;
    private sessionPath;
    private liveFeed;
    private _liveToken;
    private _liveConnected;
    private _connectAborted;
    private timeline;
    private playbackIndex;
    private playbackOffset;
    private playbackSpeed;
    private playbackStartWall;
    private playbackStartOffset;
    private playbackTimer;
    private isPlaying;
    private liveState;
    private delayedState;
    private circuitLayout;
    private _circuitFetched;
    private delayMs;
    private delayBuffer;
    private delayTimer;
    connectLive(token: string): Promise<void>;
    private _attemptLiveConnect;
    loadSession(sessionPath: string): Promise<{
        events: number;
        durationMs: number;
    }>;
    play(speed?: number): void;
    pause(): void;
    seek(offsetMs: number): Promise<void>;
    disconnectLive(): void;
    setDelay(ms: number): void;
    getDelay(): number;
    getStatus(): SessionStatus;
    getSnapshot(): Record<string, unknown>;
    getCircuit(): unknown;
    getSeasonIndex(year: number): Promise<Meeting[]>;
    getCachedSessions(): CachedSession[];
    private _reset;
    private _playbackTick;
    private _maybeLoadCircuit;
    private _startDelayTimer;
}
export declare const sessionManager: SessionManager;
//# sourceMappingURL=session-manager.d.ts.map