import GlassCard from "./GlassCard";
import { AlertTriangle, Info, CheckCircle } from "lucide-react";

export default function AlertPanel({ alerts }) {
  return (
    <GlassCard className="alert-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">EVENT STREAM</span>
          <h2>Alerts & Events</h2>
        </div>

        <span className="alert-count">{alerts.length}</span>
      </div>

      <div className="alert-list">
        {alerts.map((alert) => (
          <div className="alert-item" key={alert.id}>
            <div className={`alert-icon ${alert.severity}`}>
              {alert.severity === "warning" ? (
                <AlertTriangle size={17} />
              ) : alert.severity === "info" ? (
                <Info size={17} />
              ) : (
                <CheckCircle size={17} />
              )}
            </div>

            <div className="alert-content">
              <strong>{alert.title}</strong>
              <p>{alert.message}</p>
              <small>{alert.time}</small>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}