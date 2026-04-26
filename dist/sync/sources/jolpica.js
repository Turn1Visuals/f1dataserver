import axios from "axios";
const BASE = "https://api.jolpi.ca/ergast/f1";
const LIMIT = 100;
async function fetchAll(path) {
    const results = [];
    let offset = 0;
    while (true) {
        const url = `${BASE}${path}.json?limit=${LIMIT}&offset=${offset}`;
        const res = await axios.get(url);
        const table = res.data.MRData;
        // Find the table object (e.g. RaceTable, DriverTable) then find the array inside it
        const dataKey = Object.keys(table).find((k) => !["xmlns", "series", "url", "limit", "offset", "total"].includes(k));
        const inner = table[dataKey];
        const arrayKey = Object.keys(inner).find((k) => Array.isArray(inner[k]));
        const items = (inner[arrayKey] ?? []);
        results.push(...items);
        const total = Number(table.total);
        offset += LIMIT;
        if (offset >= total)
            break;
        // Polite delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 200));
    }
    return results;
}
export async function fetchSeasons() {
    return fetchAll("/seasons");
}
export async function fetchDrivers() {
    return fetchAll("/drivers");
}
export async function fetchConstructors() {
    return fetchAll("/constructors");
}
export async function fetchCircuits() {
    return fetchAll("/circuits");
}
export async function fetchRaces(season) {
    return fetchAll(`/${season}`);
}
// Results are nested: RaceTable.Races[0].Results[]
async function fetchNestedFromRace(path, nestedKey) {
    const races = await fetchAll(path);
    return races.flatMap((race) => race[nestedKey] ?? []);
}
export async function fetchResults(season, round) {
    return fetchNestedFromRace(`/${season}/${round}/results`, "Results");
}
export async function fetchQualifying(season, round) {
    return fetchNestedFromRace(`/${season}/${round}/qualifying`, "QualifyingResults");
}
export async function fetchSprintResults(season, round) {
    return fetchNestedFromRace(`/${season}/${round}/sprint`, "SprintResults");
}
export async function fetchDriverStandings(season, round) {
    const path = round
        ? `/${season}/${round}/driverStandings`
        : `/${season}/driverStandings`;
    return fetchNestedFromRace(path, "DriverStandings");
}
export async function fetchConstructorStandings(season, round) {
    const path = round
        ? `/${season}/${round}/constructorStandings`
        : `/${season}/constructorStandings`;
    return fetchNestedFromRace(path, "ConstructorStandings");
}
export async function fetchLapTimes(season, round) {
    return fetchNestedFromRace(`/${season}/${round}/laps`, "Laps");
}
export async function fetchPitStops(season, round) {
    return fetchNestedFromRace(`/${season}/${round}/pitstops`, "PitStops");
}
//# sourceMappingURL=jolpica.js.map