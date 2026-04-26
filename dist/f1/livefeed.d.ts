import { EventEmitter } from "events";
export interface FeedEvent {
    topic: string;
    data: unknown;
}
export declare class LiveFeed extends EventEmitter {
    private ws;
    private token;
    constructor(token: string);
    connect(): Promise<void>;
    disconnect(): void;
    private _negotiate;
    private _connectWs;
    private _handshake;
    private _subscribe;
    private _msgCount;
    private _onMessage;
}
//# sourceMappingURL=livefeed.d.ts.map