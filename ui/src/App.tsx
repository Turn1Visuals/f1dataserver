import { Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home.tsx";
import ApiDocs from "./pages/ApiDocs.tsx";
import Schema from "./pages/Schema.tsx";
import Session from "./pages/Session.tsx";
import Standings from "./pages/Standings.tsx";
import Mapping from "./pages/Mapping.tsx";
import "./App.css";

export default function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-dot" />
          <span>F1 Data Server</span>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
            <span className="nav-icon">⬡</span>
            Home
          </NavLink>
          <NavLink to="/docs" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
            <span className="nav-icon">⚡</span>
            API Docs
          </NavLink>
          <NavLink to="/schema" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
            <span className="nav-icon">◈</span>
            Schema
          </NavLink>
          <NavLink to="/session" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
            <span className="nav-icon">▶</span>
            Session
          </NavLink>
          <NavLink to="/standings" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
            <span className="nav-icon">◎</span>
            Standings
          </NavLink>
          <NavLink to="/mapping" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
            <span className="nav-icon">⇄</span>
            Mapping
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <a href="/health" className="nav-item" target="_blank" rel="noreferrer">
            <span className="nav-icon">♡</span>
            Health
          </a>
          <div className="sidebar-brand">TURN1VISUALS</div>
        </div>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/docs" element={<ApiDocs />} />
          <Route path="/schema" element={<Schema />} />
          <Route path="/session" element={<Session />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/mapping" element={<Mapping />} />
        </Routes>
      </main>
    </div>
  );
}
