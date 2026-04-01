import { useState, useCallback } from "react";
import "./Standings.css";

const BASE = import.meta.env.DEV ? "http://localhost:5320" : "";

interface DriverStanding {
  position: number;
  points: number;
  wins: number;
  driverId: string;
  code: string;
  name: string;
  nationality: string;
  team: string;
  teamId: string;
}

interface ConstructorStanding {
  position: number;
  points: number;
  wins: number;
  teamId: string;
  name: string;
  nationality: string;
}

interface StandingsResult {
  season: number;
  round: number;
  standings: DriverStanding[] | ConstructorStanding[];
}

export default function Standings() {
  const [year, setYear]         = useState(new Date().getFullYear());
  const [round, setRound]       = useState("");
  const [tab, setTab]           = useState<"drivers" | "constructors">("drivers");
  const [data, setData]         = useState<StandingsResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const fetch_ = useCallback(async (y: number, r: string, t: "drivers" | "constructors") => {
    setLoading(true);
    setError(null);
    try {
      const url = r
        ? `${BASE}/standings/${y}/${t}?round=${r}`
        : `${BASE}/standings/${y}/${t}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json() as StandingsResult;
      setData(json);
    } catch (e) {
      setError((e as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const load = () => fetch_(year, round, tab);

  const switchTab = (t: "drivers" | "constructors") => {
    setTab(t);
    if (data) fetch_(year, round, t);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Standings</div>
        <div className="page-subtitle">Driver and constructor championship standings by season and round.</div>
      </div>

      {/* Controls */}
      <div className="section">
        <div className="section-label">Filter</div>
        <div className="st-controls">
          <div className="st-control-group">
            <label className="st-label">Season</label>
            <input
              type="number"
              className="s-input"
              value={year}
              min={1950}
              max={new Date().getFullYear()}
              onChange={e => setYear(parseInt(e.target.value))}
              style={{ width: 90 }}
            />
          </div>
          <div className="st-control-group">
            <label className="st-label">Round <span className="st-optional">(optional)</span></label>
            <input
              type="number"
              className="s-input"
              value={round}
              min={1}
              placeholder="latest"
              onChange={e => setRound(e.target.value)}
              style={{ width: 90 }}
            />
          </div>
          <button className="s-btn s-btn-primary" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Load"}
          </button>
        </div>
      </div>

      {error && <div className="st-error">{error}</div>}

      {data && (
        <>
          {/* Tabs */}
          <div className="st-tabs">
            <button className={`st-tab ${tab === "drivers" ? "active" : ""}`} onClick={() => switchTab("drivers")}>
              Drivers
            </button>
            <button className={`st-tab ${tab === "constructors" ? "active" : ""}`} onClick={() => switchTab("constructors")}>
              Constructors
            </button>
            <span className="st-round-label">
              {data.season} — Round {data.round}
            </span>
          </div>

          {/* Driver standings */}
          {tab === "drivers" && (
            <table className="st-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Driver</th>
                  <th>Team</th>
                  <th>Wins</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {(data.standings as DriverStanding[]).map(s => (
                  <tr key={s.driverId}>
                    <td className="st-pos">{s.position}</td>
                    <td>
                      <span className="st-code">{s.code}</span>
                      <span className="st-name">{s.name}</span>
                    </td>
                    <td className="st-team">{s.team}</td>
                    <td className="st-wins">{s.wins}</td>
                    <td className="st-points">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Constructor standings */}
          {tab === "constructors" && (
            <table className="st-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Team</th>
                  <th>Nationality</th>
                  <th>Wins</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {(data.standings as ConstructorStanding[]).map(s => (
                  <tr key={s.teamId}>
                    <td className="st-pos">{s.position}</td>
                    <td className="st-name">{s.name}</td>
                    <td className="st-nat">{s.nationality}</td>
                    <td className="st-wins">{s.wins}</td>
                    <td className="st-points">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
