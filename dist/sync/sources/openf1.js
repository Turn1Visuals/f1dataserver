import axios from "axios";
const BASE = "https://api.openf1.org/v1";
async function get(path, params = {}) {
    let attempts = 0;
    while (true) {
        try {
            await new Promise((r) => setTimeout(r, 400)); // stay under 3 req/s
            const res = await axios.get(`${BASE}${path}`, { params });
            return res.data;
        }
        catch (err) {
            if (err?.response?.status === 404)
                return [];
            if (err?.response?.status === 429 && attempts < 5) {
                attempts++;
                const retryAfter = Number(err.response.headers["retry-after"] ?? 2);
                console.warn(`  Rate limited, retrying in ${retryAfter + 1}s...`);
                await new Promise((r) => setTimeout(r, (retryAfter + 1) * 1000));
            }
            else {
                throw err;
            }
        }
    }
}
export async function fetchOpenF1Drivers(year) {
    // Drivers are session-scoped in OpenF1 — fetch unique drivers per year via meetings
    const meetings = await fetchOpenF1Meetings(year);
    const driverMap = new Map();
    for (const meeting of meetings) {
        const drivers = await get("/drivers", {
            meeting_key: meeting.meeting_key,
        });
        for (const d of drivers) {
            // Keep the latest record per driver number
            driverMap.set(d.driver_number, d);
        }
        await new Promise((r) => setTimeout(r, 150));
    }
    return Array.from(driverMap.values());
}
export async function fetchOpenF1Meetings(year) {
    return get("/meetings", { year });
}
export async function fetchOpenF1Sessions(year) {
    return get("/sessions", { year });
}
//# sourceMappingURL=openf1.js.map