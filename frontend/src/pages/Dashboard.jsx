
import { useEffect, useMemo, useState } from "react";

import {
  Activity,
  AlertTriangle,
  Gauge,
  Radio,
  RefreshCw,
  ShieldCheck,
  Volume2,
  Cpu,
  Zap,
  TrendingUp,
  Clock3,
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

import { api } from "../services/api";
import GlassCard from "../components/GlassCard";
import Engine3D from "../components/Engine3D";

import "./Dashboard.css";


export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedSensor, setSelectedSensor] = useState("sensor_11");


  /* ============================================================
     LOAD BACKEND DATA
     ============================================================ */

  const loadDashboard = async (manual = false) => {
    try {
      if (manual) {
        setRefreshing(true);
      }

      const result = await api.getDashboard();

      setData(result);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Dashboard API error:", error);
    } finally {
      setLoading(false);

      if (manual) {
        setRefreshing(false);
      }
    }
  };


  /* ============================================================
     AUTO REFRESH
     ============================================================ */

  useEffect(() => {
    loadDashboard(false);

    const interval = setInterval(() => {
      loadDashboard(false);
    }, 5000);

    return () => clearInterval(interval);
  }, []);


  /* ============================================================
     BACKEND DATA
     ============================================================ */

  const engine = data?.engine || {};

  const history = Array.isArray(data?.history)
    ? data.history
    : [];

  const sensorHistory = Array.isArray(data?.sensorHistory)
    ? data.sensorHistory
    : [];

  const sensors = data?.sensors || {};

  const acoustic = data?.acoustic || {};


  /* ============================================================
     CURRENT ENGINE VALUES
     ============================================================ */

  const health = Number(
    engine.health_percentage ?? 0
  );

  const rul = Number(
    engine.predicted_rul ?? 0
  );

  const cycle = Number(
    engine.cycle ?? 0
  );

  const healthState =
    engine.health_state || "UNKNOWN";

  const overallStatus =
    engine.overall_status ||
    healthState ||
    "UNKNOWN";

  const anomalyScore = Number(
    engine.sensor_anomaly?.score ?? 0
  );

  const anomalySeverity =
    engine.sensor_anomaly?.severity ||
    engine.sensor_anomaly?.status ||
    "NORMAL";


  /* ============================================================
     FAILURE RISK
     ============================================================ */

  const failureRisk = Math.max(
    0,
    Math.min(
      100,
      100 - health
    )
  );

  const riskState =
    failureRisk <= 20
      ? "LOW"
      : failureRisk <= 50
      ? "MODERATE"
      : failureRisk <= 80
      ? "HIGH"
      : "CRITICAL";


  /* ============================================================
     TELEMETRY GRAPH DATA
     ============================================================ */

  const telemetryData = useMemo(() => {
    return sensorHistory.map((item) => {
      const values = item?.sensors || {};

      return {
        cycle: Number(item?.cycle ?? 0),

        sensor_2: Number(values.sensor_2 ?? 0),
        sensor_3: Number(values.sensor_3 ?? 0),
        sensor_4: Number(values.sensor_4 ?? 0),
        sensor_7: Number(values.sensor_7 ?? 0),
        sensor_8: Number(values.sensor_8 ?? 0),
        sensor_9: Number(values.sensor_9 ?? 0),
        sensor_11: Number(values.sensor_11 ?? 0),
        sensor_12: Number(values.sensor_12 ?? 0),
        sensor_13: Number(values.sensor_13 ?? 0),
        sensor_14: Number(values.sensor_14 ?? 0),
        sensor_15: Number(values.sensor_15 ?? 0),
        sensor_17: Number(values.sensor_17 ?? 0),
        sensor_20: Number(values.sensor_20 ?? 0),
        sensor_21: Number(values.sensor_21 ?? 0),
      };
    });
  }, [sensorHistory]);


  /* ============================================================
     HEALTH HISTORY
     ============================================================ */

  const healthData = useMemo(() => {
    return history.map((item) => ({
      cycle: Number(item?.cycle ?? 0),
      health: Number(item?.health_percentage ?? 0),
    }));
  }, [history]);


  /* ============================================================
     RUL HISTORY
     ============================================================ */

  const rulData = useMemo(() => {
    return history.map((item) => ({
      cycle: Number(item?.cycle ?? 0),
      rul: Number(item?.predicted_rul ?? 0),
    }));
  }, [history]);


  /* ============================================================
     SELECTED SENSOR
     ============================================================ */

  const selectedSensorData = useMemo(() => {
    return telemetryData.map((item) => ({
      cycle: item.cycle,
      value: Number(item[selectedSensor] ?? 0),
    }));
  }, [telemetryData, selectedSensor]);


  /* ============================================================
     CURRENT SENSOR VALUES
     ============================================================ */

  const currentSensors = useMemo(() => {
    if (
      sensorHistory.length > 0 &&
      sensorHistory[sensorHistory.length - 1]?.sensors
    ) {
      return sensorHistory[
        sensorHistory.length - 1
      ].sensors;
    }

    return sensors;
  }, [sensorHistory, sensors]);


  /* ============================================================
     HELPERS
     ============================================================ */

  const formatNumber = (value, digits = 2) => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "--";
    }

    return number.toFixed(digits);
  };


  const statusClass = (status) => {
    const value = String(
      status || ""
    ).toUpperCase();

    if (
      value === "HEALTHY" ||
      value === "NORMAL" ||
      value === "LOW"
    ) {
      return "good";
    }

    if (
      value === "MODERATE" ||
      value === "WARNING" ||
      value === "SUSPICIOUS"
    ) {
      return "warning";
    }

    if (
      value === "CRITICAL" ||
      value === "ANOMALOUS" ||
      value === "HIGH"
    ) {
      return "danger";
    }

    return "neutral";
  };


  /* ============================================================
     LOADING
     ============================================================ */

  if (loading || !data) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loader">
          <div className="loader-ring" />

          <span>
            INITIALIZING ENGINE TELEMETRY
          </span>

          <small>
            Connecting to Digital Twin backend...
          </small>
        </div>
      </div>
    );
  }


  /* ============================================================
     SENSOR CARDS
     ============================================================ */

  const sensorCards = [
    {
      id: "sensor_11",
      label: "Sensor 11",
      value: currentSensors.sensor_11,
    },
    {
      id: "sensor_9",
      label: "Sensor 9",
      value: currentSensors.sensor_9,
    },
    {
      id: "sensor_4",
      label: "Sensor 4",
      value: currentSensors.sensor_4,
    },
    {
      id: "sensor_7",
      label: "Sensor 7",
      value: currentSensors.sensor_7,
    },
    {
      id: "sensor_12",
      label: "Sensor 12",
      value: currentSensors.sensor_12,
    },
  ];


  /* ============================================================
     DASHBOARD
     ============================================================ */

  return (
    <div className="dashboard-page">

      {/* HEADER */}

      <div className="dashboard-header">

        <div>
          <div className="dashboard-eyebrow">
            <Radio size={12} />
            DIGITAL TWIN / LIVE MONITORING
          </div>

          <h1>
            Engine Health Dashboard
          </h1>

          <p>
            Real-time turbofan health and predictive maintenance monitoring.
          </p>
        </div>


        <div className="dashboard-actions">

          <div className="update-time">
            <Clock3 size={13} />

            {lastUpdated
              ? lastUpdated.toLocaleTimeString()
              : "--"}
          </div>

          <button
            className="refresh-button"
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
          >
            <RefreshCw
              size={14}
              className={
                refreshing
                  ? "refresh-spin"
                  : ""
              }
            />

            {refreshing
              ? "Refreshing"
              : "Refresh"}
          </button>

        </div>

      </div>


      {/* TOP KPI CARDS */}

      <div className="kpi-grid">

        <GlassCard className="kpi-card">

          <div className="kpi-icon">
            <ShieldCheck size={17} />
          </div>

          <div className="kpi-info">

            <span>
              ENGINE HEALTH
            </span>

            <strong>
              {formatNumber(health, 1)}%
            </strong>

            <small className={statusClass(healthState)}>
              {healthState}
            </small>

          </div>

        </GlassCard>


        <GlassCard className="kpi-card">

          <div className="kpi-icon">
            <Gauge size={17} />
          </div>

          <div className="kpi-info">

            <span>
              REMAINING USEFUL LIFE
            </span>

            <strong>
              {formatNumber(rul, 1)}
            </strong>

            <small>
              cycles
            </small>

          </div>

        </GlassCard>


        <GlassCard className="kpi-card">

          <div className="kpi-icon">
            <Activity size={17} />
          </div>

          <div className="kpi-info">

            <span>
              ANOMALY SCORE
            </span>

            <strong>
              {formatNumber(anomalyScore, 3)}
            </strong>

            <small className={statusClass(anomalySeverity)}>
              {anomalySeverity}
            </small>

          </div>

        </GlassCard>


        <GlassCard className="kpi-card">

          <div className="kpi-icon">
            <Cpu size={17} />
          </div>

          <div className="kpi-info">

            <span>
              CURRENT CYCLE
            </span>

            <strong>
              {cycle}
            </strong>

            <small>
              operating cycle
            </small>

          </div>

        </GlassCard>

      </div>


      {/* ENGINE + STATUS */}

      <div className="engine-grid">

        <GlassCard className="engine-card">

          <div className="card-header">

            <div>
              <span>
                DIGITAL TWIN
              </span>

              <h2>
                Engine Visualization
              </h2>
            </div>

            <div className="live-badge">
              <span />
              LIVE
            </div>

          </div>

          <div className="engine-view">
            <Engine3D />
          </div>

        </GlassCard>


        <GlassCard className="status-card">

          <div className="card-header">

            <div>
              <span>
                ENGINE STATUS
              </span>

              <h2>
                Current Condition
              </h2>
            </div>

            <Zap size={16} />

          </div>


          <div className="health-display">

            <div
              className="health-circle"
              style={{
                "--health": `${Math.max(
                  0,
                  Math.min(100, health)
                )}%`,
              }}
            >
              <div>

                <strong>
                  {formatNumber(
                    health,
                    1
                  )}%
                </strong>

                <span>
                  HEALTH
                </span>

              </div>
            </div>

          </div>


          <div
            className={`status-label ${statusClass(
              overallStatus
            )}`}
          >
            <ShieldCheck size={14} />

            {overallStatus}
          </div>


          <div className="status-list">

            <div>
              <span>
                Failure Risk
              </span>

              <strong>
                {formatNumber(
                  failureRisk,
                  1
                )}%
              </strong>
            </div>


            <div>
              <span>
                Risk Level
              </span>

              <strong
                className={statusClass(
                  riskState
                )}
              >
                {riskState}
              </strong>
            </div>


            <div>
              <span>
                Remaining Life
              </span>

              <strong>
                {formatNumber(
                  rul,
                  1
                )} cycles
              </strong>
            </div>


            <div>
              <span>
                Current Cycle
              </span>

              <strong>
                {cycle}
              </strong>
            </div>

          </div>


          <div className="recommendation">

            <TrendingUp size={15} />

            <div>

              <span>
                MAINTENANCE
              </span>

              <p>
                {engine.maintenance_recommendation ||
                  "No recommendation available."}
              </p>

            </div>

          </div>

        </GlassCard>

      </div>


      {/* SENSOR SECTION */}

      <div className="section-title">

        <div>
          <span>
            SENSOR TELEMETRY
          </span>

          <h2>
            Live Sensor Measurements
          </h2>
        </div>

        <small>
          Cycle {cycle}
        </small>

      </div>


      <div className="sensor-grid">

        {sensorCards.map((sensor) => (

          <GlassCard
            key={sensor.id}
            className={`sensor-card ${
              selectedSensor === sensor.id
                ? "active"
                : ""
            }`}
            onClick={() =>
              setSelectedSensor(sensor.id)
            }
          >

            <div className="sensor-top">

              <Activity size={14} />

              <span>
                {sensor.label}
              </span>

            </div>

            <strong>
              {formatNumber(
                sensor.value,
                2
              )}
            </strong>

            <small>
              C-MAPSS FD001
            </small>

          </GlassCard>

        ))}

      </div>


      {/* GRAPHS */}

      <div className="charts-grid">

        <GlassCard className="chart-card large-chart">

          <div className="chart-header">

            <div>

              <span>
                SENSOR TELEMETRY
              </span>

              <h2>
                {selectedSensor.replace(
                  "sensor_",
                  "Sensor "
                )} Trend
              </h2>

            </div>

            <small>
              Current{" "}
              {formatNumber(
                currentSensors[selectedSensor],
                2
              )}
            </small>

          </div>


          <div className="chart-area">

            {selectedSensorData.length > 0 ? (

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <LineChart
                  data={selectedSensorData}
                  margin={{
                    top: 8,
                    right: 8,
                    left: -15,
                    bottom: 0,
                  }}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    opacity={0.12}
                  />

                  <XAxis
                    dataKey="cycle"
                    tick={{
                      fontSize: 10,
                    }}
                    tickLine={false}
                    axisLine={false}
                  />

                  <YAxis
                    tick={{
                      fontSize: 10,
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />

                  <Tooltip
                    formatter={(value) => [
                      Number(value).toFixed(2),
                      "Value",
                    ]}
                    labelFormatter={(value) =>
                      `Cycle ${value}`
                    }
                  />

                  <Line
                    type="monotone"
                    dataKey="value"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{
                      r: 4,
                    }}
                  />

                </LineChart>

              </ResponsiveContainer>

            ) : (

              <div className="empty-chart">
                No sensor data available.
              </div>

            )}

          </div>

        </GlassCard>


        <GlassCard className="chart-card">

          <div className="chart-header">

            <div>

              <span>
                HEALTH TREND
              </span>

              <h2>
                Engine Health
              </h2>

            </div>

            <small>
              {formatNumber(
                health,
                1
              )}%
            </small>

          </div>


          <div className="chart-area">

            {healthData.length > 0 ? (

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <AreaChart
                  data={healthData}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    opacity={0.12}
                  />

                  <XAxis
                    dataKey="cycle"
                    tick={{
                      fontSize: 10,
                    }}
                    tickLine={false}
                    axisLine={false}
                  />

                  <YAxis
                    domain={[0, 100]}
                    tick={{
                      fontSize: 10,
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={35}
                  />

                  <Tooltip
                    formatter={(value) => [
                      `${Number(
                        value
                      ).toFixed(1)}%`,
                      "Health",
                    ]}
                    labelFormatter={(value) =>
                      `Cycle ${value}`
                    }
                  />

                  <Area
                    type="monotone"
                    dataKey="health"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />

                </AreaChart>

              </ResponsiveContainer>

            ) : (

              <div className="empty-chart">
                No health history available.
              </div>

            )}

          </div>

        </GlassCard>


        <GlassCard className="chart-card">

          <div className="chart-header">

            <div>

              <span>
                PREDICTIVE ANALYSIS
              </span>

              <h2>
                Remaining Useful Life
              </h2>

            </div>

            <small>
              {formatNumber(
                rul,
                1
              )} cycles
            </small>

          </div>


          <div className="chart-area">

            {rulData.length > 0 ? (

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <LineChart
                  data={rulData}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    opacity={0.12}
                  />

                  <XAxis
                    dataKey="cycle"
                    tick={{
                      fontSize: 10,
                    }}
                    tickLine={false}
                    axisLine={false}
                  />

                  <YAxis
                    tick={{
                      fontSize: 10,
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />

                  <Tooltip
                    formatter={(value) => [
                      `${Number(
                        value
                      ).toFixed(1)} cycles`,
                      "Predicted RUL",
                    ]}
                    labelFormatter={(value) =>
                      `Cycle ${value}`
                    }
                  />

                  <Line
                    type="monotone"
                    dataKey="rul"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{
                      r: 4,
                    }}
                  />

                </LineChart>

              </ResponsiveContainer>

            ) : (

              <div className="empty-chart">
                No RUL history available.
              </div>

            )}

          </div>

        </GlassCard>

      </div>


      {/* ACOUSTIC */}

      <div className="section-title acoustic-title">

        <div>

          <span>
            ACOUSTIC DIAGNOSTICS
          </span>

          <h2>
            Vibroacoustic Monitoring
          </h2>

        </div>

        <small>
          <Volume2 size={13} />
          {acoustic.status || "READY"}
        </small>

      </div>


      <GlassCard className="acoustic-card">

        <div className="acoustic-icon">
          <Volume2 size={19} />
        </div>

        <div className="acoustic-info">

          <span>
            DGEN 380 ACOUSTIC SYSTEM
          </span>

          <h3>
            {acoustic.status || "READY"}
          </h3>

          <p>
            Independent acoustic diagnostics
            available through the DGEN 380 analysis pipeline.
          </p>

        </div>


        <div className="acoustic-stats">

          <div>
            <span>
              CONFIDENCE
            </span>

            <strong>
              {acoustic.confidence != null
                ? `${Number(
                    acoustic.confidence
                  ).toFixed(2)}%`
                : "--"}
            </strong>
          </div>


          <div>
            <span>
              CONDITION
            </span>

            <strong>
              {acoustic.status || "READY"}
            </strong>
          </div>

        </div>

      </GlassCard>


      {/* FOOTER */}

      <div className="dashboard-footer">

        <span>
          <Cpu size={12} />
          NASA C-MAPSS FD001
        </span>

        <span>
          <Radio size={12} />
          FastAPI
        </span>

        <span>
          <Activity size={12} />
          Multimodal Digital Twin
        </span>

        <span>
          <ShieldCheck size={12} />
          Predictive Maintenance
        </span>

      </div>

    </div>
  );
}

