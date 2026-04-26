export declare function fetchSeasons(): Promise<JolpikaSeasonRaw[]>;
export declare function fetchDrivers(): Promise<JolpikaDriverRaw[]>;
export declare function fetchConstructors(): Promise<JolpikaConstructorRaw[]>;
export declare function fetchCircuits(): Promise<JolpikaCircuitRaw[]>;
export declare function fetchRaces(season: number): Promise<JolpikaRaceRaw[]>;
export declare function fetchResults(season: number, round: number): Promise<JolpikaResultRaw[]>;
export declare function fetchQualifying(season: number, round: number): Promise<JolpikaQualifyingRaw[]>;
export declare function fetchSprintResults(season: number, round: number): Promise<JolpikaResultRaw[]>;
export declare function fetchDriverStandings(season: number, round?: number): Promise<JolpikaStandingsListRaw[]>;
export declare function fetchConstructorStandings(season: number, round?: number): Promise<JolpikaStandingsListRaw[]>;
export declare function fetchLapTimes(season: number, round: number): Promise<JolpikaLapRaw[]>;
export declare function fetchPitStops(season: number, round: number): Promise<JolpikaPitStopRaw[]>;
export interface JolpikaSeasonRaw {
    season: string;
    url: string;
}
export interface JolpikaDriverRaw {
    driverId: string;
    permanentNumber?: string;
    code?: string;
    url: string;
    givenName: string;
    familyName: string;
    dateOfBirth: string;
    nationality: string;
}
export interface JolpikaConstructorRaw {
    constructorId: string;
    url: string;
    name: string;
    nationality: string;
}
export interface JolpikaCircuitRaw {
    circuitId: string;
    url: string;
    circuitName: string;
    Location: {
        lat: string;
        long: string;
        locality: string;
        country: string;
    };
}
export interface JolpikaRaceRaw {
    season: string;
    round: string;
    url: string;
    raceName: string;
    Circuit: JolpikaCircuitRaw;
    date: string;
    time?: string;
}
export interface JolpikaResultRaw {
    number: string;
    position: string;
    positionText: string;
    points: string;
    Driver: JolpikaDriverRaw;
    Constructor: JolpikaConstructorRaw;
    grid: string;
    laps: string;
    status: string;
    Time?: {
        millis?: string;
        time: string;
    };
    FastestLap?: {
        rank: string;
        lap: string;
        Time: {
            time: string;
        };
        AverageSpeed: {
            units: string;
            speed: string;
        };
    };
}
export interface JolpikaQualifyingRaw {
    number: string;
    position: string;
    Driver: JolpikaDriverRaw;
    Constructor: JolpikaConstructorRaw;
    Q1?: string;
    Q2?: string;
    Q3?: string;
}
export interface JolpikaStandingsListRaw {
    season: string;
    round: string;
    DriverStandings?: JolpikaDriverStandingRaw[];
    ConstructorStandings?: JolpikaConstructorStandingRaw[];
}
export interface JolpikaDriverStandingRaw {
    position: string;
    positionText: string;
    points: string;
    wins: string;
    Driver: JolpikaDriverRaw;
    Constructors: JolpikaConstructorRaw[];
}
export interface JolpikaConstructorStandingRaw {
    position: string;
    positionText: string;
    points: string;
    wins: string;
    Constructor: JolpikaConstructorRaw;
}
export interface JolpikaLapRaw {
    number: string;
    Timings: {
        driverId: string;
        position: string;
        time: string;
    }[];
}
export interface JolpikaPitStopRaw {
    driverId: string;
    lap: string;
    stop: string;
    time: string;
    duration: string;
}
//# sourceMappingURL=jolpica.d.ts.map