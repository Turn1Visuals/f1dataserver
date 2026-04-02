import { useState, useEffect } from "react";
import "./Mapping.css";

const BASE = import.meta.env.DEV ? "/api" : "";

interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  code: string | null;
  permanentNumber: number | null;
  f1Reference: string | null;
}

interface Constructor {
  id: string;
  name: string;
  f1Slug: string | null;
}

function computeDefaultRef(firstName: string, lastName: string): string {
  const a = firstName.slice(0, 3).toUpperCase().padEnd(3, "X");
  const b = lastName.slice(0, 3).toUpperCase().padEnd(3, "X");
  return `${a}${b}01`;
}

export default function Mapping() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [constructors, setConstructors] = useState<Constructor[]>([]);
  const [tab, setTab] = useState<"drivers" | "constructors">("constructors");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const [driverEdits, setDriverEdits] = useState<Record<string, string>>({});
  const [constructorEdits, setConstructorEdits] = useState<Record<string, string>>({});

  const load = async (y: number) => {
    setLoading(true);
    const [driversRaw, constructorsRaw] = await Promise.all([
      fetch(`${BASE}/drivers?season=${y}`).then(r => r.json()),
      fetch(`${BASE}/constructors?season=${y}`).then(r => r.json()),
    ]);
    setDrivers(driversRaw as Driver[]);
    setConstructors(constructorsRaw as Constructor[]);
    setDriverEdits({});
    setConstructorEdits({});
    setLoading(false);
  };

  useEffect(() => { load(year); }, []);

  const saveDriver = async (driver: Driver) => {
    setSaving(driver.id);
    const value = driverEdits[driver.id] ?? driver.f1Reference ?? "";
    const f1Reference = value.trim() || null;
    await fetch(`${BASE}/drivers/${driver.id}/meta`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ f1Reference }),
    });
    setSaving(null);
    setDriverEdits(prev => { const next = { ...prev }; delete next[driver.id]; return next; });
    setDrivers(prev => prev.map(d => d.id === driver.id ? { ...d, f1Reference } : d));
  };

  const saveConstructor = async (c: Constructor) => {
    setSaving(c.id);
    const value = constructorEdits[c.id] ?? c.f1Slug ?? "";
    const f1Slug = value.trim() || null;
    await fetch(`${BASE}/constructors/${c.id}/meta`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ f1Slug }),
    });
    setSaving(null);
    setConstructorEdits(prev => { const next = { ...prev }; delete next[c.id]; return next; });
    setConstructors(prev => prev.map(con => con.id === c.id ? { ...con, f1Slug } : con));
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">F1 Reference Mapping</div>
        <div className="page-subtitle">Map F1 image slugs and references to drivers and constructors.</div>
      </div>

      <div className="section">
        <div className="mapping-controls">
          <input
            type="number"
            className="year-input"
            value={year}
            min={2018}
            max={2030}
            onChange={e => setYear(Number(e.target.value))}
          />
          <button className="btn" onClick={() => load(year)} disabled={loading}>
            {loading ? "Loading..." : "Load"}
          </button>
        </div>
      </div>

      <div className="section">
        <div className="tab-bar">
          <button className={`tab ${tab === "constructors" ? "active" : ""}`} onClick={() => setTab("constructors")}>
            Constructors ({constructors.length})
          </button>
          <button className={`tab ${tab === "drivers" ? "active" : ""}`} onClick={() => setTab("drivers")}>
            Drivers ({drivers.length})
          </button>
        </div>
      </div>

      {loading && <div className="section"><span className="muted">Loading...</span></div>}

      {!loading && tab === "constructors" && (
        <div className="section">
          <table className="mapping-table">
            <thead>
              <tr>
                <th>Constructor</th>
                <th>F1 Slug</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {constructors.map(c => {
                const dirty = c.id in constructorEdits;
                const value = dirty ? constructorEdits[c.id] : (c.f1Slug ?? "");
                return (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>
                      <input
                        className="meta-input"
                        placeholder="e.g. redbullracing"
                        value={value}
                        onChange={e => setConstructorEdits(prev => ({ ...prev, [c.id]: e.target.value }))}
                      />
                    </td>
                    <td>
                      <button
                        className={`btn btn-sm ${dirty ? "" : "btn-ghost"}`}
                        disabled={!dirty || saving === c.id}
                        onClick={() => saveConstructor(c)}
                      >
                        {saving === c.id ? "..." : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === "drivers" && (
        <div className="section">
          <table className="mapping-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>F1 Reference</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {drivers.map(d => {
                const dirty = d.id in driverEdits;
                const stored = d.f1Reference ?? computeDefaultRef(d.firstName, d.lastName);
                const value = dirty ? driverEdits[d.id] : stored;
                const isDefault = !d.f1Reference;
                return (
                  <tr key={d.id}>
                    <td>
                      <span className="driver-code">{d.code ?? d.permanentNumber ?? "—"}</span>
                      {" "}{d.firstName} {d.lastName}
                    </td>
                    <td>
                      <input
                        className={`meta-input${isDefault && !dirty ? " meta-input-default" : ""}`}
                        placeholder="e.g. LANNOR01"
                        value={value}
                        onChange={e => setDriverEdits(prev => ({ ...prev, [d.id]: e.target.value }))}
                      />
                    </td>
                    <td>
                      <button
                        className={`btn btn-sm ${dirty ? "" : "btn-ghost"}`}
                        disabled={!dirty || saving === d.id}
                        onClick={() => saveDriver(d)}
                      >
                        {saving === d.id ? "..." : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
