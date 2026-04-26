export declare function fetchOpenF1Drivers(year: number): Promise<OpenF1DriverRaw[]>;
export declare function fetchOpenF1Meetings(year: number): Promise<OpenF1MeetingRaw[]>;
export declare function fetchOpenF1Sessions(year: number): Promise<OpenF1SessionRaw[]>;
export interface OpenF1DriverRaw {
    driver_number: number;
    broadcast_name: string;
    full_name: string;
    name_acronym: string;
    team_name: string;
    team_colour: string;
    first_name: string;
    last_name: string;
    headshot_url: string | null;
    country_code: string | null;
    session_key: number;
    meeting_key: number;
}
export interface OpenF1MeetingRaw {
    meeting_key: number;
    meeting_name: string;
    meeting_official_name: string;
    location: string;
    country_key: number;
    country_code: string;
    country_name: string;
    circuit_key: number;
    circuit_short_name: string;
    circuit_type: string;
    gmt_offset: string;
    date_start: string;
    date_end: string;
    year: number;
}
export interface OpenF1SessionRaw {
    session_key: number;
    session_name: string;
    session_type: string;
    date_start: string;
    date_end: string;
    meeting_key: number;
    circuit_key: number;
    circuit_short_name: string;
    country_key: number;
    country_code: string;
    country_name: string;
    location: string;
    gmt_offset: string;
    year: number;
}
//# sourceMappingURL=openf1.d.ts.map