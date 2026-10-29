import { NavLink } from "react-router-dom";

import {
  LayoutDashboard,
  Activity,
  Box,
  BarChart3,
  AudioWaveform,
  BrainCircuit,
  Wrench,
  Settings,
  Plane,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "Live Monitoring", path: "/live", icon: Activity },
  { name: "Digital Twin", path: "/digital-twin", icon: Box },
  { name: "Analytics", path: "/analytics", icon: BarChart3 },
  { name: "Acoustic Analysis", path: "/acoustic", icon: AudioWaveform },
  { name: "Explainable AI", path: "/xai", icon: BrainCircuit },
  { name: "Maintenance", path: "/maintenance", icon: Wrench },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <Plane size={21} />
        </div>

        <div>
          <div className="brand-title">AEROTWIN</div>
          <div className="brand-subtitle">ENGINE INTELLIGENCE</div>
        </div>
      </div>

      <div className="nav-label">MONITORING</div>

      <nav>
        {navigation.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="connection-box">
          <span className="live-dot" />
          <div>
            <strong>System Online</strong>
            <small>API Connected</small>
          </div>
        </div>

        <NavLink to="/settings" className="nav-item">
          <Settings size={18} />
          <span>Settings</span>
        </NavLink>
      </div>
    </aside>
  );
}