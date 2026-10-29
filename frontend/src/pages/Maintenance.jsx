
import { useEffect, useMemo, useState } from "react";
import {
  Wrench,
  Activity,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Gauge,
  Cpu,
  CalendarClock,
  ClipboardCheck,
  TrendingDown,
} from "lucide-react";

import GlassCard from "../components/GlassCard";
import { api } from "../services/api";

import "./Maintenance.css";

function formatNumber(value, decimals = 2) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "--";
  }

  return Number(value).toFixed(decimals);
}

function statusClass(status) {
  const value = String(status || "").toUpperCase();

  if (
    value === "HEALTHY" ||
    value === "NORMAL" ||
    value === "COMPLETED"
  ) {
    return "maintenance-good";
  }

  if (
    value === "MODERATE" ||
    value === "SUSPICIOUS" ||
    value === "WARNING"
  ) {
    return "maintenance-warning";
  }

  return "maintenance-danger";
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}) {
  return (
    <div className="maintenance-section-header">

      <div className="maintenance-section-icon">
        <Icon size={16} />
      </div>

      <div>
        <h2>{title}</h2>

        {subtitle && (
          <p>{subtitle}</p>
        )}
      </div>

    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  icon: Icon,
}) {
  return (
    <div className="maintenance-metric">

      <div className="maintenance-metric-top">

        <span>
          {label}
        </span>

        {Icon && (
          <Icon size={15} />
        )}

      </div>

      <strong>
        {value}
      </strong>

      {sub && (
        <small>
          {sub}
        </small>
      )}

    </div>
  );
}

export default function Maintenance() {
  const [state, setState] = useState(null);
  const [history, setHistory] = useState([]);
  const [metrics, setMetrics] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [lastUpdated, setLastUpdated] =
    useState(null);

  const [error, setError] = useState("");

  const loadData = async (
    manualRefresh = false
  ) => {
    try {
      setError("");

      if (manualRefresh) {
        setRefreshing(true);
      }

      const [
        stateData,
        historyData,
        metricsData,
      ] = await Promise.all([
        api.getEngineState(1),
        api.getEngineHistory(1),
        api.getModelMetrics(),
      ]);

      setState(stateData);

      setHistory(
        historyData?.history || []
      );

      setMetrics(metricsData);

      setLastUpdated(new Date());

    } catch (err) {
      console.error(
        "Maintenance load error:",
        err
      );

      setError(
        "Unable to load maintenance data."
      );

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);
    

    const timer = setInterval(() => {
      loadData(false);
    }, 5000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const predictedRul = Number(
    state?.predicted_rul || 0
  );

  const healthPercentage = Number(
    state?.health_percentage || 0
  );

  const currentCycle =
    state?.cycle ?? "--";

  const healthState =
    state?.health_state || "--";

  const overallStatus =
    state?.overall_status || "--";

  const anomaly =
    state?.sensor_anomaly || {};

  const anomalySeverity =
    anomaly.severity || "--";

  const anomalyScore =
    Number(anomaly.score);

  const recommendation =
    state?.maintenance_recommendation ||
    "No maintenance recommendation available.";

  /*
   * Determine maintenance priority
   * from the backend engine condition.
   */
  const maintenancePriority =
    useMemo(() => {
      const rul = predictedRul;

      if (
        overallStatus === "CRITICAL" ||
        healthState === "CRITICAL" ||
        rul <= 20
      ) {
        return {
          label: "CRITICAL",
          description:
            "Immediate maintenance attention required.",
          icon: AlertTriangle,
        };
      }

      if (
        overallStatus === "WARNING" ||
        healthState === "WARNING" ||
        rul <= 50 ||
        anomalySeverity === "ANOMALOUS"
      ) {
        return {
          label: "HIGH",
          description:
            "Maintenance planning should be initiated.",
          icon: Wrench,
        };
      }

      if (
        healthState === "MODERATE" ||
        anomalySeverity === "SUSPICIOUS" ||
        rul <= 80
      ) {
        return {
          label: "MEDIUM",
          description:
            "Continue monitoring and plan maintenance.",
          icon: Clock3,
        };
      }

      return {
        label: "LOW",
        description:
          "Normal operation. Continue routine monitoring.",
        icon: CheckCircle2,
      };
    }, [
      predictedRul,
      overallStatus,
      healthState,
      anomalySeverity,
    ]);

  const PriorityIcon =
    maintenancePriority.icon;

  /*
   * Latest history entry.
   */
  const latestHistory =
    history.length > 0
      ? history[history.length - 1]
      : null;

  /*
   * Compare latest RUL with previous cycle.
   */
  const previousHistory =
    history.length > 1
      ? history[history.length - 2]
      : null;

  const rulTrend = useMemo(() => {
    if (
      !latestHistory ||
      !previousHistory
    ) {
      return null;
    }

    const current = Number(
      latestHistory.predicted_rul
    );

    const previous = Number(
      previousHistory.predicted_rul
    );

    if (
      Number.isNaN(current) ||
      Number.isNaN(previous)
    ) {
      return null;
    }

    return current - previous;
  }, [
    latestHistory,
    previousHistory,
  ]);

  const rulMetrics =
    metrics?.cmapss || {};

  if (loading) {
    return (
      <div className="maintenance-page">

        <div className="maintenance-page-header">

          <div>
            <span className="maintenance-eyebrow">
              PREDICTIVE MAINTENANCE
            </span>

            <h1>
              Maintenance
            </h1>

            <p>
              Maintenance recommendations based on
              current engine health and predicted RUL.
            </p>
          </div>

        </div>

        <div className="maintenance-loading">

          <RefreshCw
            size={18}
            className="maintenance-spin"
          />

          <span>
            Loading maintenance data...
          </span>

        </div>

      </div>
    );
  }

  return (
    <div className="maintenance-page">

      {/* ================= HEADER ================= */}

      <div className="maintenance-page-header">

        <div>

          <span className="maintenance-eyebrow">
            PREDICTIVE MAINTENANCE
          </span>

          <h1>
            Maintenance
          </h1>

          <p>
            Maintenance recommendations based on
            current engine health and predicted RUL.
          </p>

        </div>

        <div className="maintenance-header-actions">

          <div className="maintenance-live-status">

            <span className="maintenance-live-dot" />

            <span>
              LIVE
            </span>

          </div>

          <button
            className={`maintenance-refresh-btn ${
              refreshing
                ? "refreshing"
                : ""
            }`}
            onClick={() =>
              loadData(true)
            }
            disabled={refreshing}
            title="Refresh maintenance data"
          >
            <RefreshCw size={14} />
          </button>

        </div>

      </div>

      {/* ================= ERROR ================= */}

      {error && (
        <div className="maintenance-error">

          <AlertTriangle size={15} />

          <span>
            {error}
          </span>

        </div>
      )}

      {/* ================= PRIORITY ================= */}

      <GlassCard>

        <div className="maintenance-card">

          <div className="maintenance-priority">

            <div
              className={`maintenance-priority-icon ${
                statusClass(
                  maintenancePriority.label
                )
              }`}
            >
              <PriorityIcon size={22} />
            </div>

            <div className="maintenance-priority-content">

              <span>
                MAINTENANCE PRIORITY
              </span>

              <h2>
                {maintenancePriority.label}
              </h2>

              <p>
                {maintenancePriority.description}
              </p>

            </div>

            <div
              className={`maintenance-priority-status ${
                statusClass(
                  maintenancePriority.label
                )
              }`}
            >
              {overallStatus}
            </div>

          </div>

        </div>

      </GlassCard>

      {/* ================= OVERVIEW ================= */}

      <div className="maintenance-overview-grid">

        <GlassCard>

          <div className="maintenance-card">

            <div className="maintenance-card-top">

              <div>

                <span className="maintenance-card-label">
                  REMAINING USEFUL LIFE
                </span>

                <h3>
                  Predicted RUL
                </h3>

              </div>

              <div className="maintenance-card-icon blue">
                <Activity size={16} />
              </div>

            </div>

            <div className="maintenance-main-value">

              <strong>
                {formatNumber(
                  predictedRul,
                  1
                )}
              </strong>

              <span>
                cycles
              </span>

            </div>

            <div className="maintenance-status-line">

              <span
                className={`maintenance-status-pill ${
                  statusClass(
                    healthState
                  )
                }`}
              >
                {healthState}
              </span>

              {rulTrend !== null && (
                <span
                  className={
                    rulTrend < 0
                      ? "maintenance-trend-down"
                      : "maintenance-trend-up"
                  }
                >
                  <TrendingDown size={13} />

                  {rulTrend < 0
                    ? `${formatNumber(
                        Math.abs(rulTrend),
                        2
                      )} cycles since previous cycle`
                    : `+${formatNumber(
                        rulTrend,
                        2
                      )} cycles since previous cycle`}
                </span>
              )}

            </div>

          </div>

        </GlassCard>

        <GlassCard>

          <div className="maintenance-card">

            <div className="maintenance-card-top">

              <div>

                <span className="maintenance-card-label">
                  ENGINE HEALTH
                </span>

                <h3>
                  Current Condition
                </h3>

              </div>

              <div className="maintenance-card-icon green">
                <ShieldCheck size={16} />
              </div>

            </div>

            <div className="maintenance-main-value">

              <strong>
                {formatNumber(
                  healthPercentage,
                  1
                )}
              </strong>

              <span>
                %
              </span>

            </div>

            <div className="maintenance-status-line">

              <span
                className={`maintenance-status-pill ${
                  statusClass(
                    overallStatus
                  )
                }`}
              >
                {overallStatus}
              </span>

            </div>

          </div>

        </GlassCard>

        <GlassCard>

          <div className="maintenance-card">

            <div className="maintenance-card-top">

              <div>

                <span className="maintenance-card-label">
                  CURRENT CYCLE
                </span>

                <h3>
                  Engine Operation
                </h3>

              </div>

              <div className="maintenance-card-icon purple">
                <Gauge size={16} />
              </div>

            </div>

            <div className="maintenance-main-value">

              <strong>
                {currentCycle}
              </strong>

              <span>
                cycles
              </span>

            </div>

            <div className="maintenance-status-line">

              <span>
                Engine {state?.engine_id ?? 1}
              </span>

            </div>

          </div>

        </GlassCard>

      </div>

      {/* ================= RECOMMENDATION ================= */}

      <GlassCard>

        <div className="maintenance-card">

          <SectionHeader
            icon={Wrench}
            title="Maintenance Recommendation"
            subtitle="Recommendation generated from the current Digital Twin engine state."
          />

          <div className="maintenance-recommendation">

            <div
              className={`maintenance-recommendation-icon ${
                statusClass(
                  healthState
                )
              }`}
            >
              <Wrench size={20} />
            </div>

            <div>

              <span>
                CURRENT RECOMMENDATION
              </span>

              <strong>
                {recommendation}
              </strong>

              <small>
                Based on predicted RUL,
                engine health and current
                anomaly assessment.
              </small>

            </div>

          </div>

        </div>

      </GlassCard>

      {/* ================= MAINTENANCE ASSESSMENT ================= */}

      <GlassCard>

        <div className="maintenance-card">

          <SectionHeader
            icon={ClipboardCheck}
            title="Maintenance Assessment"
            subtitle="Current indicators used to determine maintenance priority."
          />

          <div className="maintenance-metrics-grid">

            <Metric
              label="PREDICTED RUL"
              value={`${formatNumber(
                predictedRul,
                1
              )} cycles`}
              sub="Random Forest prediction"
              icon={Activity}
            />

            <Metric
              label="HEALTH"
              value={`${formatNumber(
                healthPercentage,
                1
              )}%`}
              sub={healthState}
              icon={ShieldCheck}
            />

            <Metric
              label="ANOMALY"
              value={
                anomalySeverity
              }
              sub={
                Number.isFinite(
                  anomalyScore
                )
                  ? `Score ${formatNumber(
                      anomalyScore,
                      4
                    )}`
                  : "Sensor anomaly assessment"
              }
              icon={ShieldCheck}
            />

            <Metric
              label="CURRENT CYCLE"
              value={currentCycle}
              sub="Engine operating cycle"
              icon={Gauge}
            />

          </div>

        </div>

      </GlassCard>

      {/* ================= RUL THRESHOLDS ================= */}

      <GlassCard>

        <div className="maintenance-card">

          <SectionHeader
            icon={Activity}
            title="Maintenance Thresholds"
            subtitle="Backend health-state classification used by the Digital Twin."
          />

          <div className="maintenance-threshold-grid">

            <div className="maintenance-threshold healthy">

              <span>
                HEALTHY
              </span>

              <strong>
                &gt; 80
              </strong>

              <small>
                cycles
              </small>

            </div>

            <div className="maintenance-threshold moderate">

              <span>
                MODERATE
              </span>

              <strong>
                50–80
              </strong>

              <small>
                cycles
              </small>

            </div>

            <div className="maintenance-threshold warning">

              <span>
                WARNING
              </span>

              <strong>
                20–50
              </strong>

              <small>
                cycles
              </small>

            </div>

            <div className="maintenance-threshold critical">

              <span>
                CRITICAL
              </span>

              <strong>
                ≤ 20
              </strong>

              <small>
                cycles
              </small>

            </div>

          </div>

        </div>

      </GlassCard>

      {/* ================= ANOMALY ================= */}

      <GlassCard>

        <div className="maintenance-card">

          <SectionHeader
            icon={ShieldCheck}
            title="Sensor Anomaly Assessment"
            subtitle="Current Isolation Forest assessment for the selected engine."
          />

          <div className="maintenance-anomaly">

            <div
              className={`maintenance-anomaly-status ${
                statusClass(
                  anomalySeverity
                )
              }`}
            >

              {anomalySeverity ===
              "NORMAL" ? (
                <CheckCircle2
                  size={20}
                />
              ) : (
                <AlertTriangle
                  size={20}
                />
              )}

              <div>

                <strong>
                  {anomalySeverity}
                </strong>

                <span>
                  {anomaly.status ||
                    "--"}
                </span>

              </div>

            </div>

            <div className="maintenance-anomaly-score">

              <span>
                ANOMALY SCORE
              </span>

              <strong>
                {Number.isFinite(
                  anomalyScore
                )
                  ? formatNumber(
                      anomalyScore,
                      4
                    )
                  : "--"}
              </strong>

            </div>

          </div>

        </div>

      </GlassCard>

      {/* ================= MODEL INFORMATION ================= */}

      <div className="maintenance-two-column">

        <GlassCard>

          <div className="maintenance-card">

            <SectionHeader
              icon={Cpu}
              title="Prediction Model"
              subtitle="Model used for maintenance-oriented RUL estimation."
            />

            <div className="maintenance-model-info">

              <div className="maintenance-model-row">

                <span>
                  MODEL
                </span>

                <strong>
                  {rulMetrics.model ||
                    "RandomForestRegressor"}
                </strong>

              </div>

              <div className="maintenance-model-row">

                <span>
                  INPUT FEATURES
                </span>

                <strong>
                  {rulMetrics.selected_sensors?.length ||
                    14} sensors
                </strong>

              </div>

              <div className="maintenance-model-row">

                <span>
                  RUL CAP
                </span>

                <strong>
                  {rulMetrics.rul_cap ??
                    125} cycles
                </strong>

              </div>

              <div className="maintenance-model-row">

                <span>
                  TEST MAE
                </span>

                <strong>
                  {typeof rulMetrics.official_test_mae ===
                  "number"
                    ? `${rulMetrics.official_test_mae.toFixed(
                        2
                      )} cycles`
                    : "--"}
                </strong>

              </div>

              <div className="maintenance-model-row">

                <span>
                  TEST RMSE
                </span>

                <strong>
                  {typeof rulMetrics.official_test_rmse ===
                  "number"
                    ? `${rulMetrics.official_test_rmse.toFixed(
                        2
                      )} cycles`
                    : "--"}
                </strong>

              </div>

            </div>

          </div>

        </GlassCard>

        <GlassCard>

          <div className="maintenance-card">

            <SectionHeader
              icon={CalendarClock}
              title="Maintenance Status"
              subtitle="Current maintenance planning state."
            />

            <div className="maintenance-planning">

              <div
                className={`maintenance-planning-icon ${
                  statusClass(
                    maintenancePriority.label
                  )
                }`}
              >
                <CalendarClock
                  size={21}
                />
              </div>

              <div>

                <span>
                  PRIORITY
                </span>

                <strong>
                  {maintenancePriority.label}
                </strong>

                <small>
                  {maintenancePriority.description}
                </small>

              </div>

            </div>

            <div className="maintenance-planning-note">

              <ShieldCheck size={14} />

              <span>
                Maintenance priority is derived
                from backend engine condition and
                anomaly assessment.
              </span>

            </div>

          </div>

        </GlassCard>

      </div>

      {/* ================= FOOTER ================= */}

      <div className="maintenance-footer">

        <span>
          Predictive Maintenance • Engine{" "}
          {state?.engine_id ?? 1}
        </span>

        <span>
          {lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString()}`
            : "Live monitoring"}
        </span>

      </div>

    </div>
  );
}

