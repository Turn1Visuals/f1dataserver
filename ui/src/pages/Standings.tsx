import { useState, useCallback } from "react";
import "./Standings.css";

const BASE = import.meta.env.DEV ? "http://localhost:5320" : "";

interface DriverStanding {
  position: number; points: number; wins: number;
  driverId: string; code: string; name: string;
  nationality: string; team: string; teamId: string; teamSlug: string | null;
}

interface ConstructorStanding {
  position: number; points: number; wins: number;
  teamId: string; name: string; nationality: string; teamSlug: string | null;
}

interface StandingsResult {
  season: number; round: number;
  standings: DriverStanding[] | ConstructorStanding[];
}

function teamLogoUrl(year: number, slug: string) {
  return `https://media.formula1.com/image/upload/common/f1/${year}/${slug}/${year}${slug}logowhite.svg`;
}

export default function Standings() {
  const [year, setYear]     = useState(new Date().getFullYear());
  const [round, setRound]   = useState("");
  const [tab, setTab]       = useState<"drivers" | "constructors">("drivers");
  const [data, setData]     = useState<StandingsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const fetch_ = useCallback(async (y: number, r: string, t: "drivers" | "constructors") => {
    setLoading(true); setError(null);
    try {
      const url = r ? `${BASE}/standings/${y}/${t}?round=${r}` : `${BASE}/standings/${y}/${t}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setData(await res.json() as StandingsResult);
    } catch (e) {
      setError((e as Error).message); setData(null);
    } finally { setLoading(false); }
  }, []);

  const load = () => fetch_(year, round, tab);
  const switchTab = (t: "drivers" | "constructors") => {
    setTab(t);
    if (data) fetch_(year, round, t);
  };

  return (
    <div className="page">
      <div className="page-title">Standings</div>
      <div className="page-sub">Driver and constructor championship standings by season and round.</div>

      <div className="divider" />

      {/* Controls */}
      <div className="st-controls">
        <div className="st-field">
          <label className="st-field-label">Season</label>
          <input type="number" className="input" value={year} min={1950} max={new Date().getFullYear()}
            onChange={e => setYear(parseInt(e.target.value))} style={{ width: 90 }} />
        </div>
        <div className="st-field">
          <label className="st-field-label">Round <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(optional)</span></label>
          <input type="number" className="input" value={round} min={1} placeholder="latest"
            onChange={e => setRound(e.target.value)} style={{ width: 90 }} />
        </div>
        <button className="btn btn-primary" onClick={load} disabled={loading} style={{ alignSelf: "flex-end" }}>
          {loading ? "Loading…" : "Load"}
        </button>
      </div>

      {error && <div className="st-error">{error}</div>}

      {data && (
        <>
          <div className="st-tabs">
            <button className={`st-tab ${tab === "drivers" ? "active" : ""}`} onClick={() => switchTab("drivers")}>Drivers</button>
            <button className={`st-tab ${tab === "constructors" ? "active" : ""}`} onClick={() => switchTab("constructors")}>Constructors</button>
            <span className="st-meta">{data.season} · Round {data.round}</span>
          </div>

          {tab === "drivers" && (
            <table className="st-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>Driver</th>
                  <th>Team</th>
                  <th style={{ textAlign: "right" }}>Wins</th>
                  <th style={{ textAlign: "right" }}>Points</th>
                </tr>
              </thead>
              <tbody>
                {(data.standings as DriverStanding[]).map(s => (
                  <tr key={s.driverId}>
                    <td className="st-pos">{s.position}</td>
                    <td>
                      <span className="st-code">{s.code}</span>
                      <span>{s.name}</span>
                    </td>
                    <td className="st-team">
                      {s.teamSlug && <img src={teamLogoUrl(data!.season, s.teamSlug)} alt="" className="team-logo" />}
                      {s.team}
                    </td>
                    <td className="st-num">{s.wins}</td>
                    <td className="st-points">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "constructors" && (
            <table className="st-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>Team</th>
                  <th>Nationality</th>
                  <th style={{ textAlign: "right" }}>Wins</th>
                  <th style={{ textAlign: "right" }}>Points</th>
                </tr>
              </thead>
              <tbody>
                {(data.standings as ConstructorStanding[]).map(s => (
                  <tr key={s.teamId}>
                    <td className="st-pos">{s.position}</td>
                    <td className="st-team">
                      {s.teamSlug && <img src={teamLogoUrl(data!.season, s.teamSlug)} alt="" className="team-logo" />}
                      {s.name}
                    </td>
                    <td>{s.nationality}</td>
                    <td className="st-num">{s.wins}</td>
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
