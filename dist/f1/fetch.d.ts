export declare const TOPICS: readonly ["SessionInfo", "SessionData", "SessionStatus", "DriverList", "TimingData", "TimingAppData", "TimingStats", "RaceControlMessages", "TrackStatus", "ExtrapolatedClock", "TopThree", "LapCount", "WeatherData", "Position.z", "CarData.z"];
export type Topic = (typeof TOPICS)[number];
export interface TimelineEvent {
    offset: number;
    topic: Topic;
    data: unknown;
}
export interface Meeting {
    Name: string;
    Key: string;
    Location?: string;
    Sessions?: Array<{
        Name: string;
        Path: string;
    }>;
}
export declare function fetchJson<T>(path: string): Promise<T>;
export declare function fetchStream(path: string): Promise<string>;
export declare function parseStream(text: string): Array<{
    offset: number;
    data: unknown;
}>;
export declare function fetchSeasonIndex(year: number): Promise<Meeting[]>;
export declare function fetchTopic(sessionPath: string, topic: Topic): Promise<Array<{
    offset: number;
    data: unknown;
}>>;
//# sourceMappingURL=fetch.d.ts.map