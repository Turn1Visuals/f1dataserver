import { Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home.tsx";
import ApiDocs from "./pages/ApiDocs.tsx";
import Schema from "./pages/Schema.tsx";
import Session from "./pages/Session.tsx";
import Standings from "./pages/Standings.tsx";
import Mapping from "./pages/Mapping.tsx";
import "./App.css";

const nav = [
  { to: "/",          end: true,  icon: "⬡", label: "Home"      },
  { to: "/docs",      end: false, icon: "⚡", label: "API Docs"  },
  { to: "/schema",    end: false, icon: "◈", label: "Schema"    },
  { to: "/session",   end: false, icon: "▶", label: "Session"   },
  { to: "/standings", end: false, icon: "◎", label: "Standings" },
  { to: "/mapping",   end: false, icon: "⇄", label: "Mapping"   },
];

export default function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-dot" />
          <span className="logo-text">F1 Data Server</span>
        </div>

        <nav className="sidebar-nav">
          {nav.map(({ to, end, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
            >
              <span className="nav-icon">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <a href="/health" className="nav-item" target="_blank" rel="noreferrer">
            <span className="nav-icon">♡</span>
            Health
          </a>
          <div className="sidebar-brand">Turn1Visuals</div>
        </div>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/"          element={<Home />}      />
          <Route path="/docs"      element={<ApiDocs />}   />
          <Route path="/schema"    element={<Schema />}    />
          <Route path="/session"   element={<Session />}   />
          <Route path="/standings" element={<Standings />} />
          <Route path="/mapping"   element={<Mapping />}   />
        </Routes>
      </main>
    </div>
  );
}
