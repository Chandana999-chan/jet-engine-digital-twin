
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Gauge,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from "recharts";

import GlassCard from "../components/GlassCard";
import Engine3D from "../components/Engine3D";
import { api } from "../services/api";
import "./DigitalTwin.css";

const SENSOR_CONFIG = [
  {
    key: "sensor_11",
    label: "S11",
    name: "Core Temperature",
    unit: "",
  },
  {
    key: "sensor_9",
    label: "S9",
    name: "Core Pressure",
    unit: "",
  },
  {
    key: "sensor_4",
    label: "S4",
    name: "Fan Pressure",
    unit: "",
  },
  {
    key: "sensor_7",
    label: "S7",
    name: "Fan Speed",
    unit: "",
  },
  {
    key: "sensor_12",
    label: "S12",
    name: "Static Pressure",
    unit: "",
  },
];

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }

  return Number(value).toFixed(digits);
}

function healthClass(state) {
  const value = String(state || "").toUpperCase();

  if (value === "HEALTHY" || value === "NORMAL") {
    return "good";
  }

  if (
    value === "MODERATE" ||
    value === "WARNING" ||
    value === "SUSPICIOUS"
  ) {
    return "warning";
  }

  return "danger";
}

function statusIcon(state) {
  const cls = healthClass(state);

  if (cls === "good") {
    return <CheckCircle2 size={16} />;
  }

  if (cls === "warning") {
    return <AlertTriangle size={16} />;
  }

  return <AlertTriangle size={16} />;
}

function StatCard({ icon, label, value, subtext, status }) {
  return (
    <GlassCard className="dt-stat-card">
      <div className="dt-stat-top">
        <div className="dt-stat-icon">{icon}</div>

        {status && (
          <span className={`dt-status-dot ${healthClass(status)}`} />
        )}
      </div>

      <div className="dt-stat-label">{label}</div>

      <div className="dt-stat-value">{value}</div>

      {subtext && <div className="dt-stat-subtext">{subtext}</div>}
    </GlassCard>
  );
}

function SensorCard({ sensor, value, history }) {
  const numericValue = Number(value);

  const trend =
    history.length >= 2
      ? Number(
          history[history.length - 1]?.sensors?.[sensor.key] ?? 0
        ) -
        Number(
          history[history.length - 2]?.sensors?.[sensor.key] ?? 0
        )
      : 0;

  const trendUp = trend >= 0;

  return (
    <GlassCard className="dt-sensor-card">
      <div className="dt-sensor-header">
        <div>
          <span className="dt-sensor-code">{sensor.label}</span>
          <span className="dt-sensor-name">{sensor.name}</span>
        </div>

        <Activity size={14} />
      </div>

      <div className="dt-sensor-value">
        {Number.isFinite(numericValue)
          ? numericValue.toFixed(2)
          : "--"}
      </div>

      <div className="dt-sensor-footer">
        <span>Sensor telemetry</span>

        <span className={`dt-trend ${trendUp ? "up" : "down"}`}>
          {trendUp ? (
            <TrendingUp size={12} />
          ) : (
            <TrendingDown size={12} />
          )}

          {Math.abs(trend).toFixed(2)}
        </span>
      </div>
    </GlassCard>
  );
}

export default function DigitalTwin() {
  const [data, setData] = useState(null);
  const [sensorData, setSensorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadData(manualRefresh = false) {
    try {
      if (manualRefresh) {
        setRefreshing(true);
      }

      setError("");

      const [state, historyResponse, sensorsResponse] =
        await Promise.all([
          api.getEngineState(1),
          api.getEngineHistory(1),
          api.getSensors(1),
        ]);

      setData({
        state,
        history: Array.isArray(historyResponse?.history)
          ? historyResponse.history
          : [],
      });

      setSensorData({
        sensors: sensorsResponse?.sensors || [],
        history: Array.isArray(sensorsResponse?.history)
          ? sensorsResponse.history
          : [],
      });
    } catch (err) {
      console.error("Digital Twin loading error:", err);
      setError("Unable to connect to the Digital Twin backend.");
    } finally {
      setLoading(false);

      if (manualRefresh) {
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    loadData(false);
    

    const interval = setInterval(() => {
      loadData(false);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const engine = data?.state || {};
  const history = data?.history || [];
  const sensorHistory = sensorData?.history || [];
  const currentSensors = sensorHistory.length
    ? sensorHistory[sensorHistory.length - 1]?.sensors || {}
    : {};

  const health = Number(engine.health_percentage ?? 0);
  const rul = Number(engine.predicted_rul ?? 0);
  const cycle = Number(engine.cycle ?? 0);

  const healthState = engine.health_state || "UNKNOWN";
  const overallStatus =
    engine.overall_status || healthState || "UNKNOWN";

  const anomaly = engine.sensor_anomaly || {};
  const anomalySeverity =
    anomaly.severity || anomaly.status || "NORMAL";

  const risk = Math.max(
    0,
    Math.min(100, 100 - health)
  );

  const rulChartData = useMemo(() => {
    return history.map((item) => ({
      cycle: item.cycle,
      rul: Number(item.predicted_rul ?? 0),
      health: Number(item.health_percentage ?? 0),
    }));
  }, [history]);

  const selectedSensorHistory = useMemo(() => {
    return sensorHistory.map((item) => ({
      cycle: item.cycle,
      s11: Number(item.sensors?.sensor_11 ?? 0),
      s9: Number(item.sensors?.sensor_9 ?? 0),
      s4: Number(item.sensors?.sensor_4 ?? 0),
      s7: Number(item.sensors?.sensor_7 ?? 0),
      s12: Number(item.sensors?.sensor_12 ?? 0),
    }));
  }, [sensorHistory]);

  if (loading || !data) {
    return (
      <div className="digital-twin-page">
        <div className="dt-loading">
          <div className="dt-loading-spinner">
            <RefreshCw size={22} />
          </div>

          <div>
            <strong>Loading Digital Twin</strong>
            <span>Connecting to engine telemetry...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="digital-twin-page">
      {/* HEADER */}
      <div className="dt-page-header">
        <div>
          <div className="dt-eyebrow">
            <Cpu size={13} />
            DIGITAL TWIN
          </div>

          <h1>Engine Digital Twin</h1>

          <p>
            Live virtual representation of turbofan engine health,
            telemetry and predicted remaining useful life.
          </p>
        </div>

        <button
          className="dt-refresh-btn"
          onClick={() => loadData(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={14}
            className={refreshing ? "dt-spin" : ""}
          />

          {refreshing ? "Refreshing" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="dt-error">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}

      {/* KPI ROW */}
      <div className="dt-stat-grid">
        <StatCard
          icon={<ShieldCheck size={17} />}
          label="ENGINE HEALTH"
          value={`${formatNumber(health, 1)}%`}
          subtext={healthState}
          status={healthState}
        />

        <StatCard
          icon={<Gauge size={17} />}
          label="PREDICTED RUL"
          value={`${formatNumber(rul, 1)}`}
          subtext="cycles remaining"
          status={healthState}
        />

        <StatCard
          icon={<Activity size={17} />}
          label="CURRENT CYCLE"
          value={cycle}
          subtext="C-MAPSS telemetry"
        />

        <StatCard
          icon={<Zap size={17} />}
          label="FAILURE RISK"
          value={`${formatNumber(risk, 1)}%`}
          subtext="derived from health"
          status={risk > 50 ? "CRITICAL" : risk > 20 ? "WARNING" : "NORMAL"}
        />
      </div>

      {/* DIGITAL TWIN + STATUS */}
      <div className="dt-main-grid">
        <GlassCard className="dt-engine-card">
          <div className="dt-card-header">
            <div>
              <span className="dt-card-kicker">LIVE MODEL</span>
              <h2>Virtual Engine</h2>
            </div>

            <div
              className={`dt-live-badge ${healthClass(
                overallStatus
              )}`}
            >
              <span />
              LIVE
            </div>
          </div>

          <div className="dt-engine-view">
            <Engine3D />
          </div>
        </GlassCard>

        <GlassCard className="dt-status-card">
          <div className="dt-card-header">
            <div>
              <span className="dt-card-kicker">ENGINE STATE</span>
              <h2>Digital Twin Status</h2>
            </div>

            {statusIcon(overallStatus)}
          </div>

          <div className="dt-health-display">
            <div
              className={`dt-health-ring ${healthClass(
                healthState
              )}`}
              style={{
                "--health": `${Math.max(
                  0,
                  Math.min(100, health)
                ) * 3.6}deg`,
              }}
            >
              <div>
                <strong>{formatNumber(health, 1)}%</strong>
                <span>Health</span>
              </div>
            </div>
          </div>

          <div className="dt-status-row">
            <span>Overall Status</span>
            <strong className={healthClass(overallStatus)}>
              {overallStatus}
            </strong>
          </div>

          <div className="dt-status-row">
            <span>Health State</span>
            <strong>{healthState}</strong>
          </div>

          <div className="dt-status-row">
            <span>Sensor Anomaly</span>
            <strong className={healthClass(anomalySeverity)}>
              {anomalySeverity}
            </strong>
          </div>

          <div className="dt-status-row">
            <span>Anomaly Score</span>
            <strong>
              {formatNumber(anomaly.score, 4)}
            </strong>
          </div>

          <div className="dt-recommendation">
            <span>MAINTENANCE RECOMMENDATION</span>
            <p>
              {engine.maintenance_recommendation ||
                "No maintenance recommendation available."}
            </p>
          </div>
        </GlassCard>
      </div>

      {/* SENSOR TELEMETRY */}
      <div className="dt-section-title">
        <div>
          <span>LIVE TELEMETRY</span>
          <h2>Engine Sensor Parameters</h2>
        </div>

        <div className="dt-cycle-label">
          Cycle <strong>{cycle}</strong>
        </div>
      </div>

      <div className="dt-sensor-grid">
        {SENSOR_CONFIG.map((sensor) => (
          <SensorCard
            key={sensor.key}
            sensor={sensor}
            value={currentSensors[sensor.key]}
            history={sensorHistory}
          />
        ))}
      </div>

      {/* GRAPHS */}
      <div className="dt-chart-grid">
        <GlassCard className="dt-chart-card dt-chart-wide">
          <div className="dt-chart-header">
            <div>
              <span className="dt-card-kicker">PREDICTION</span>
              <h2>Remaining Useful Life</h2>
            </div>

            <div className="dt-chart-value">
              {formatNumber(rul, 1)}
              <span>cycles</span>
            </div>
          </div>

          <div className="dt-chart-area">
            {rulChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rulChartData}>
                  <defs>
                    <linearGradient
                      id="rulGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="100%"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.06)"
                  />

                  <XAxis
                    dataKey="cycle"
                    tick={{
                      fontSize: 9,
                      fill: "rgba(255,255,255,0.45)",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    tick={{
                      fontSize: 9,
                      fill: "rgba(255,255,255,0.45)",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    contentStyle={{
                      background: "rgba(13,18,28,0.95)",
                      border:
                        "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="rul"
                    strokeWidth={2}
                    fill="url(#rulGradient)"
                    fillOpacity={1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="dt-no-data">
                No RUL history available
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard className="dt-chart-card">
          <div className="dt-chart-header">
            <div>
              <span className="dt-card-kicker">HEALTH</span>
              <h2>Health Trend</h2>
            </div>

            <div className="dt-chart-value">
              {formatNumber(health, 1)}
              <span>%</span>
            </div>
          </div>

          <div className="dt-chart-area">
            {rulChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rulChartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.06)"
                  />

                  <XAxis
                    dataKey="cycle"
                    tick={{
                      fontSize: 9,
                      fill: "rgba(255,255,255,0.45)",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    domain={[0, 100]}
                    tick={{
                      fontSize: 9,
                      fill: "rgba(255,255,255,0.45)",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    contentStyle={{
                      background: "rgba(13,18,28,0.95)",
                      border:
                        "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />

                  <Line
                    type="monotone"
                    dataKey="health"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="dt-no-data">
                No health history available
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard className="dt-chart-card dt-sensor-chart">
          <div className="dt-chart-header">
            <div>
              <span className="dt-card-kicker">TELEMETRY</span>
              <h2>Sensor Trends</h2>
            </div>
          </div>

          <div className="dt-chart-area">
            {selectedSensorHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selectedSensorHistory}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.06)"
                  />

                  <XAxis
                    dataKey="cycle"
                    tick={{
                      fontSize: 9,
                      fill: "rgba(255,255,255,0.45)",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    tick={{
                      fontSize: 9,
                      fill: "rgba(255,255,255,0.45)",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    contentStyle={{
                      background: "rgba(13,18,28,0.95)",
                      border:
                        "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontSize: 10,
                    }}
                  />

                  <Line
                    type="monotone"
                    dataKey="s11"
                    strokeWidth={1.7}
                    dot={false}
                  />

                  <Line
                    type="monotone"
                    dataKey="s9"
                    strokeWidth={1.7}
                    dot={false}
                  />

                  <Line
                    type="monotone"
                    dataKey="s4"
                    strokeWidth={1.7}
                    dot={false}
                  />

                  <Line
                    type="monotone"
                    dataKey="s7"
                    strokeWidth={1.7}
                    dot={false}
                  />

                  <Line
                    type="monotone"
                    dataKey="s12"
                    strokeWidth={1.7}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="dt-no-data">
                No sensor history available
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* DIGITAL TWIN INFORMATION */}
      <GlassCard className="dt-info-card">
        <div className="dt-info-header">
          <div>
            <span className="dt-card-kicker">
              DIGITAL TWIN STATE
            </span>
            <h2>Model Synchronization</h2>
          </div>

          <div className="dt-sync">
            <CheckCircle2 size={14} />
            Synchronized
          </div>
        </div>

        <div className="dt-info-grid">
          <div>
            <span>Engine ID</span>
            <strong>{engine.engine_id ?? 1}</strong>
          </div>

          <div>
            <span>Simulation Cycle</span>
            <strong>{cycle}</strong>
          </div>

          <div>
            <span>RUL Prediction</span>
            <strong>{formatNumber(rul, 2)} cycles</strong>
          </div>

          <div>
            <span>Health Estimate</span>
            <strong>{formatNumber(health, 2)}%</strong>
          </div>

          <div>
            <span>Anomaly Score</span>
            <strong>{formatNumber(anomaly.score, 4)}</strong>
          </div>

          <div>
            <span>Overall Condition</span>
            <strong className={healthClass(overallStatus)}>
              {overallStatus}
            </strong>
          </div>
        </div>
      </GlassCard>

      <div className="dt-footer">
        <span>
          Digital Twin synchronized with FastAPI backend
        </span>

        <span>
          Auto refresh: <strong>5 sec</strong>
        </span>
      </div>
    </div>
  );
}
