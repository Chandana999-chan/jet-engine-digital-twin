import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import GlassCard from "../components/GlassCard";
import { api } from "../services/api";

export default function Analytics() {
  const [history, setHistory] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [currentState, setCurrentState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const [historyResult, metricsResult, stateResult] =
          await Promise.all([
            api.getEngineHistory(1),
            api.getModelMetrics(),
            api.getEngineState(1),
          ]);

        setHistory(historyResult.history || []);
        setMetrics(metricsResult);
        setCurrentState(stateResult);
      } catch (error) {
        console.error("Analytics API error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();

    const interval = setInterval(loadAnalytics, 10000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        Loading analytics...
      </div>
    );
  }

  const chartData = history.map((item) => ({
    cycle: item.cycle,
    rul: Number(item.predicted_rul ?? 0),
    health: Number(item.health_percentage ?? 0),
  }));

  const averageHealth =
    history.length > 0
      ? history.reduce(
          (sum, item) => sum + Number(item.health_percentage ?? 0),
          0
        ) / history.length
      : 0;

  const currentRul = Number(
    currentState?.predicted_rul ?? 0
  );

  const currentHealth = Number(
    currentState?.health_percentage ?? 0
  );

  const anomalySeverity =
    currentState?.sensor_anomaly?.severity ||
    currentState?.sensor_anomaly?.status ||
    "NORMAL";

  const modelMetrics = metrics?.rul || metrics?.rul_model || metrics || {};

  const mae =
    modelMetrics.mae ??
    modelMetrics.MAE ??
    null;

  const rmse =
    modelMetrics.rmse ??
    modelMetrics.RMSE ??
    null;

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">
            PERFORMANCE INTELLIGENCE
          </span>

          <h1>Analytics</h1>

          <p>
            Historical engine performance and degradation trends.
          </p>
        </div>

        <div className="live-indicator">
          ● ANALYTICS CONNECTED
        </div>
      </div>

      <div className="dashboard-grid two-column">
        <GlassCard className="chart-card large">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                TREND ANALYSIS
              </span>

              <h2>Remaining Useful Life</h2>
            </div>

            <span className="component-status">
              {history.length} cycles
            </span>
          </div>

          <div className="chart-container">
            {chartData.length > 0 ? (
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    opacity={0.08}
                  />

                  <XAxis
                    dataKey="cycle"
                    label={{
                      value: "Engine Cycle",
                      position: "insideBottom",
                      offset: -5,
                    }}
                  />

                  <YAxis
                    label={{
                      value: "RUL (cycles)",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />

                  <Tooltip />

                  <Line
                    type="monotone"
                    dataKey="rul"
                    stroke="#68d5ff"
                    strokeWidth={3}
                    dot={false}
                    name="Predicted RUL"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                No historical RUL data available.
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <span className="eyebrow">
            ENGINE HEALTH
          </span>

          <h2>Current Status</h2>

          <div className="metric-list">
            <div>
              <span>Current Health</span>
              <strong>
                {currentHealth.toFixed(1)}%
              </strong>
            </div>

            <div>
              <span>Predicted RUL</span>
              <strong>
                {currentRul.toFixed(1)} cycles
              </strong>
            </div>

            <div>
              <span>Engine Cycle</span>
              <strong>
                {currentState?.cycle ?? "--"}
              </strong>
            </div>

            <div>
              <span>Sensor Anomaly</span>
              <strong>
                {anomalySeverity}
              </strong>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="dashboard-grid two-column">
        <GlassCard>
          <span className="eyebrow">
            HISTORICAL ANALYSIS
          </span>

          <h2>Health Trend</h2>

          <div className="chart-container">
            {chartData.length > 0 ? (
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    opacity={0.08}
                  />

                  <XAxis dataKey="cycle" />

                  <YAxis
                    domain={[0, 100]}
                  />

                  <Tooltip />

                  <Line
                    type="monotone"
                    dataKey="health"
                    stroke="#68d5ff"
                    strokeWidth={3}
                    dot={false}
                    name="Engine Health"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                No health history available.
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <span className="eyebrow">
            MODEL PERFORMANCE
          </span>

          <h2>RUL Prediction Model</h2>

          <div className="metric-list">
            <div>
              <span>Model</span>
              <strong>Random Forest</strong>
            </div>

            <div>
              <span>MAE</span>
              <strong>
                {mae !== null
                  ? Number(mae).toFixed(2)
                  : "--"}
              </strong>
            </div>

            <div>
              <span>RMSE</span>
              <strong>
                {rmse !== null
                  ? Number(rmse).toFixed(2)
                  : "--"}
              </strong>
            </div>

            <div>
              <span>Average Historical Health</span>
              <strong>
                {averageHealth.toFixed(1)}%
              </strong>
            </div>
          </div>
        </GlassCard>
      </div>
    </>
  );
}