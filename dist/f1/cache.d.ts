import type { TimelineEvent } from "./fetch.js";
export declare function isCached(sessionPath: string): boolean;
export declare function writeCache(sessionPath: string, timeline: TimelineEvent[]): void;
export declare function appendCache(sessionPath: string, event: TimelineEvent): void;
export declare function readCache(sessionPath: string): TimelineEvent[];
export interface CachedSession {
    sessionPath: string;
    year: number;
    sizeBytes: number;
}
export declare function listCached(): CachedSession[];
//# sourceMappingURL=cache.d.ts.map