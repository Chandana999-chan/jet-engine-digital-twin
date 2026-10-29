
import { useEffect, useState } from "react";
import { Activity, Radio } from "lucide-react";

import { api } from "../services/api";
import GlassCard from "../components/GlassCard";
import SensorCard from "../components/SensorCard";

export default function LiveMonitoring() {
  const [data, setData] = useState(null);
  const [engineState, setEngineState] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    const load = async () => {
      try {
        const result = await api.getSensors(1);

        setData(result);
        setLastUpdated(new Date());
      } catch (error) {
        console.error("Live monitoring error:", error);
      }
    };

    load();

    const interval = setInterval(load, 2000);

    const unsubscribe = api.onEngineChange(() => {
      load();
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  if (!data) {
    return (
      <div className="loading-screen">
        Connecting to sensors...
      </div>
    );
  }

  const history = Array.isArray(data.history)
    ? data.history
    : [];

  const latest =
    history.length > 0
      ? history[history.length - 1]
      : null;

  const sensors = latest?.sensors || {};

  const sensorEntries = Object.entries(sensors);

  /*
   * REAL BACKEND ANOMALY STATUS
   *
   * Comes from:
   * GET /engine/1/state
   *
   * Example:
   * sensor_anomaly: {
   *   status: "NORMAL",
   *   severity: "NORMAL",
   *   score: 0.0899
   * }
   */
  const anomaly = engineState?.sensor_anomaly || {};

  const anomalySeverity =
    anomaly.severity ||
    anomaly.status ||
    "NORMAL";

  const getSensorStatus = () => {
    const severity = String(
      anomalySeverity
    ).toUpperCase();

    if (severity === "ANOMALOUS") {
      return "ANOMALOUS";
    }

    if (severity === "SUSPICIOUS") {
      return "SUSPICIOUS";
    }

    return "NORMAL";
  };

  const sensorStatus = getSensorStatus();

  const statusClass = (status) => {
    const value = String(status).toUpperCase();

    if (value === "NORMAL") {
      return "normal";
    }

    if (value === "SUSPICIOUS") {
      return "warning";
    }

    return "danger";
  };

  return (
    <>
      {/* HEADER */}

      <div className="page-header">
        <div>
          <span className="eyebrow">
            REAL-TIME TELEMETRY
          </span>

          <h1>Live Monitoring</h1>

          <p>
            Continuous engine parameter monitoring.
          </p>
        </div>

        <div className="live-indicator">
          <Radio size={17} />

          STREAM ACTIVE

          <small>
            Updated {lastUpdated.toLocaleTimeString()}
          </small>
        </div>
      </div>

      {/* LIVE SENSOR CARDS */}

      <div className="sensor-grid">
        {sensorEntries.map(([sensorName, value]) => (
          <SensorCard
            key={sensorName}
            name={sensorName
              .replace("_", " ")
              .toUpperCase()}
            label="C-MAPSS SENSOR"
            value={
              Number.isFinite(Number(value))
                ? Number(value).toFixed(2)
                : "--"
            }
            unit=""
            icon={<Activity size={18} />}
          />
        ))}
      </div>

      {/* SENSOR HISTORY GRAPH / TABLE */}

      <GlassCard className="live-table-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              SENSOR HISTORY
            </span>

            <h2>Engine Sensor Trends</h2>

            <p>
              Historical sensor readings across engine
              cycles.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Cycle</th>

                {data.sensors?.map((sensor) => (
                  <th key={sensor}>
                    {sensor.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {history.map((item) => (
                <tr key={item.cycle}>
                  <td>{item.cycle}</td>

                  {data.sensors?.map((sensor) => (
                    <td key={sensor}>
                      {item.sensors?.[sensor] !== undefined
                        ? Number(
                            item.sensors[sensor]
                          ).toFixed(2)
                        : "--"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* LIVE STREAM TABLE */}

      <GlassCard className="live-table-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              STREAM
            </span>

            <h2>Incoming Telemetry</h2>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Current</th>
                <th>Status</th>
                <th>Source</th>
              </tr>
            </thead>

            <tbody>
              {sensorEntries.map(([key, value]) => (
                <tr key={key}>
                  <td>
                    {key
                      .replace("_", " ")
                      .toUpperCase()}
                  </td>

                  <td>
                    {Number.isFinite(Number(value))
                      ? Number(value).toFixed(2)
                      : "--"}
                  </td>

                  <td>
                    <span
                      className={`status-pill ${statusClass(
                        sensorStatus
                      )}`}
                    >
                      {sensorStatus}
                    </span>
                  </td>

                  <td>
                    NASA C-MAPSS FD001
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </>
  );
}
