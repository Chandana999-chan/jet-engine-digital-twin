import {
  ShieldCheck,
  AlertTriangle,
  Activity,
} from "lucide-react";

import GlassCard from "./GlassCard";

export default function EngineStatus({ engine }) {
  const health = Number(
    engine?.health_percentage ?? 0
  );

  const rul = Number(
    engine?.predicted_rul ?? 0
  );

  const anomalyScore = Number(
    engine?.sensor_anomaly?.score ?? 0
  );

  const healthState =
    engine?.health_state ||
    engine?.overall_status ||
    "UNKNOWN";

  const overallStatus =
    engine?.overall_status ||
    healthState;

  let failureRisk = 100 - health;

  if (failureRisk < 0) {
    failureRisk = 0;
  }

  if (failureRisk > 100) {
    failureRisk = 100;
  }

  const riskLabel =
    failureRisk <= 20
      ? "LOW"
      : failureRisk <= 50
      ? "MEDIUM"
      : failureRisk <= 80
      ? "HIGH"
      : "CRITICAL";

  const anomalyStatus =
    engine?.sensor_anomaly?.severity ||
    engine?.sensor_anomaly?.status ||
    "NORMAL";

  return (
    <GlassCard>
      <div className="engine-status">
        <div className="engine-status-header">
          <div>
            <span className="eyebrow">
              ENG-00{engine?.engine_id ?? 1}
            </span>

            <h2>CURRENT CONDITION</h2>
          </div>

          <div className="engine-status-icon">
            {overallStatus === "HEALTHY" ? (
              <ShieldCheck size={20} />
            ) : (
              <AlertTriangle size={20} />
            )}
          </div>
        </div>

        <div className="engine-status-main">
          <div className="engine-health-display">
            <span className="engine-status-label">
              Engine Health
            </span>

            <strong>
              {health.toFixed(1)}
              <small>%</small>
            </strong>

            <span
              className={`engine-status-pill ${
                healthState === "HEALTHY"
                  ? "healthy"
                  : "warning"
              }`}
            >
              {healthState}
            </span>
          </div>
        </div>

        <div className="engine-status-grid">

          <div className="engine-status-item">
            <div className="engine-status-item-top">
              <Activity size={15} />

              <span>HEALTH</span>
            </div>

            <strong>
              {health.toFixed(1)}%
            </strong>

            <small>
              {healthState}
            </small>
          </div>

          <div className="engine-status-item">
            <div className="engine-status-item-top">
              <AlertTriangle size={15} />

              <span>FAILURE RISK</span>
            </div>

            <strong>
              {failureRisk.toFixed(1)}%
            </strong>

            <small>
              {riskLabel}
            </small>
          </div>

          <div className="engine-status-item">
            <div className="engine-status-item-top">
              <ShieldCheck size={15} />

              <span>REMAINING LIFE</span>
            </div>

            <strong>
              {rul.toFixed(1)}
            </strong>

            <small>
              cycles
            </small>
          </div>

          <div className="engine-status-item">
            <div className="engine-status-item-top">
              <Activity size={15} />

              <span>ANOMALY</span>
            </div>

            <strong>
              {anomalyScore.toFixed(3)}
            </strong>

            <small>
              {anomalyStatus}
            </small>
          </div>

        </div>
      </div>
    </GlassCard>
  );
}