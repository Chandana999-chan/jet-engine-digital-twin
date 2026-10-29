import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  Activity,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Cpu,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";

import GlassCard from "../components/GlassCard";
import { api } from "../services/api";

import "./ExplainableAI.css";

function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }

  return Number(value).toFixed(decimals);
}

function sensorLabel(name) {
  if (!name) return "--";

  return name
    .replace("sensor_", "S")
    .replace("_", " ")
    .toUpperCase();
}

function healthClass(state) {
  const value = String(state || "").toUpperCase();

  if (value === "HEALTHY" || value === "NORMAL") {
    return "xai-good";
  }

  if (value === "MODERATE" || value === "SUSPICIOUS") {
    return "xai-warning";
  }

  return "xai-danger";
}

function MiniGauge({ value, label, unit, type = "blue" }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className="xai-mini-gauge-wrap">
      <div
        className={`xai-mini-gauge ${type}`}
        style={{
          background: `conic-gradient(
            var(--xai-gauge-color) ${safeValue * 3.6}deg,
            rgba(255,255,255,0.07) ${safeValue * 3.6}deg
          )`,
        }}
      >
        <div className="xai-mini-gauge-inner">
          <strong>{formatNumber(safeValue, 0)}</strong>
          <span>%</span>
        </div>
      </div>

      <div className="xai-gauge-text">
        <div>{label}</div>
        <small>{unit}</small>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }) {
  return (
    <div className="xai-metric">
      <span className="xai-metric-label">{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function ShapBar({ feature, value, maxValue }) {
  const numericValue = Number(value) || 0;
  const width =
    maxValue > 0
      ? Math.min((Math.abs(numericValue) / maxValue) * 100, 100)
      : 0;

  const positive = numericValue >= 0;

  return (
    <div className="xai-shap-row">
      <div className="xai-shap-name">{sensorLabel(feature)}</div>

      <div className="xai-shap-track">
        <div
          className={`xai-shap-fill ${
            positive ? "positive" : "negative"
          }`}
          style={{ width: `${width}%` }}
        />
      </div>

      <div
        className={`xai-shap-value ${
          positive ? "positive-text" : "negative-text"
        }`}
      >
        {positive ? "+" : ""}
        {formatNumber(numericValue, 3)}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="xai-section-header">
      <div className="xai-section-icon">
        <Icon size={16} />
      </div>

      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}

export default function ExplainableAI() {
  const [state, setState] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");

  const loadData = async (manualRefresh = false) => {
    try {
      setError("");

      // Only the button shows refreshing state.
      // The existing page stays visible.
      if (manualRefresh) {
        setRefreshing(true);
      }

      const [stateData, explanationData, metricsData] =
        await Promise.all([
          api.getEngineState(1),
          api.getExplanation(1),
          api.getModelMetrics(),
        ]);

      setState(stateData);
      setExplanation(explanationData);
      setMetrics(metricsData);
      setLastUpdated(new Date());

    } catch (err) {
      console.error("Explainable AI load error:", err);
      setError("Unable to load explainability data.");

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

    return () => clearInterval(timer);
  }, []);

  const features = useMemo(() => {
    if (!explanation?.features) return [];

    if (Array.isArray(explanation.features)) {
      return explanation.features;
    }

    return Object.entries(explanation.features).map(
      ([feature, data]) => ({
        feature,
        value: data?.value ?? data?.feature_value ?? 0,
        shap_value: data?.shap_value ?? data?.contribution ?? 0,
      })
    );
  }, [explanation]);

  const topFeatures = useMemo(() => {
    if (features.length === 0) return [];

    return [...features]
      .sort(
        (a, b) =>
          Math.abs(Number(b.shap_value || b.contribution || 0)) -
          Math.abs(Number(a.shap_value || a.contribution || 0))
      )
      .slice(0, 8);
  }, [features]);

  const maxShap = useMemo(() => {
    if (!topFeatures.length) return 1;

    return Math.max(
      ...topFeatures.map((item) =>
        Math.abs(Number(item.shap_value || item.contribution || 0))
      ),
      1
    );
  }, [topFeatures]);

  const positive = useMemo(() => {
    if (explanation?.positive_contributors) {
      return explanation.positive_contributors;
    }

    return features
      .filter(
        (item) =>
          Number(item.shap_value || item.contribution || 0) > 0
      )
      .sort(
        (a, b) =>
          Number(b.shap_value || b.contribution || 0) -
          Number(a.shap_value || a.contribution || 0)
      )
      .slice(0, 5);
  }, [explanation, features]);

  const negative = useMemo(() => {
    if (explanation?.negative_contributors) {
      return explanation.negative_contributors;
    }

    return features
      .filter(
        (item) =>
          Number(item.shap_value || item.contribution || 0) < 0
      )
      .sort(
        (a, b) =>
          Number(a.shap_value || a.contribution || 0) -
          Number(b.shap_value || b.contribution || 0)
      )
      .slice(0, 5);
  }, [explanation, features]);

  const healthPercentage = Number(state?.health_percentage || 0);
  const predictedRul = Number(state?.predicted_rul || 0);

  const baseValue = Number(explanation?.base_value || 0);
  const shapSum = Number(explanation?.shap_sum || 0);
  const reconstructed =
    Number(explanation?.reconstructed_prediction || 0);

  const predictionDifference =
    Math.abs(predictedRul - reconstructed);

  if (loading) {
    return (
      <div className="xai-page">
        <div className="xai-page-header">
          <div>
            <span className="xai-eyebrow">MODEL INTERPRETABILITY</span>
            <h1>Explainable AI</h1>
            <p>
              Understand how individual engine sensors influence the
              predicted remaining useful life.
            </p>
          </div>
        </div>

        <div className="xai-loading">
          <RefreshCw size={18} className="xai-spin" />
          <span>Loading explainability data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="xai-page">

      {/* HEADER */}
      <div className="xai-page-header">
        <div>
          <span className="xai-eyebrow">MODEL INTERPRETABILITY</span>
          <h1>Explainable AI</h1>
          <p>
            Sensor-level explanation of the engine RUL prediction.
          </p>
        </div>

        <div className="xai-header-status">
          <div className="xai-live-dot" />
          <span>LIVE</span>

          <button
            className={`xai-refresh-btn ${refreshing ? "refreshing" : ""}`}
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="Refresh data"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div className="xai-error">
          <AlertTriangle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* TOP OVERVIEW */}
      <div className="xai-overview-grid">

        <GlassCard>
          <div className="xai-card">
            <div className="xai-card-top">
              <div>
                <span className="xai-card-label">PREDICTED RUL</span>
                <h3>Remaining Useful Life</h3>
              </div>

              <div className="xai-card-icon blue">
                <Activity size={16} />
              </div>
            </div>

            <div className="xai-gauge-row">
              <MiniGauge
                value={Math.min((predictedRul / 150) * 100, 100)}
                label="RUL"
                unit="cycles"
                type="blue"
              />

              <div className="xai-main-number">
                <strong>{formatNumber(predictedRul, 1)}</strong>
                <span>cycles</span>

                <div
                  className={`xai-status-pill ${healthClass(
                    state?.health_state
                  )}`}
                >
                  {state?.health_state || "--"}
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="xai-card">
            <div className="xai-card-top">
              <div>
                <span className="xai-card-label">ENGINE HEALTH</span>
                <h3>Current Condition</h3>
              </div>

              <div className="xai-card-icon green">
                <ShieldCheck size={16} />
              </div>
            </div>

            <div className="xai-gauge-row">
              <MiniGauge
                value={healthPercentage}
                label="Health"
                unit="percentage"
                type="green"
              />

              <div className="xai-main-number">
                <strong>{formatNumber(healthPercentage, 1)}</strong>
                <span>percent</span>

                <div
                  className={`xai-status-pill ${healthClass(
                    state?.overall_status
                  )}`}
                >
                  {state?.overall_status || "--"}
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="xai-card">
            <div className="xai-card-top">
              <div>
                <span className="xai-card-label">MODEL</span>
                <h3>Prediction Engine</h3>
              </div>

              <div className="xai-card-icon purple">
                <Brain size={16} />
              </div>
            </div>

            <div className="xai-model-info">
              <div className="xai-model-name">
                {explanation?.model || "RandomForestRegressor"}
              </div>

              <div className="xai-model-line">
                <span>Method</span>
                <strong>
                  {explanation?.explanation_method ||
                    "SHAP TreeExplainer"}
                </strong>
              </div>

              <div className="xai-model-line">
                <span>Engine</span>
                <strong>Engine {state?.engine_id ?? 1}</strong>
              </div>

              <div className="xai-model-line">
                <span>Cycle</span>
                <strong>{explanation?.cycle ?? "--"}</strong>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* SHAP FEATURE IMPORTANCE */}
      <GlassCard>
        <div className="xai-card xai-feature-card">

          <SectionHeader
            icon={Brain}
            title="SHAP Feature Contribution"
            subtitle="How each sensor contributes to the predicted RUL."
          />

          <div className="xai-feature-content">

            <div className="xai-shap-chart">
              {topFeatures.length > 0 ? (
                topFeatures.map((item, index) => {
                  const value = Number(
                    item.shap_value ?? item.contribution ?? 0
                  );

                  return (
                    <ShapBar
                      key={`${item.feature}-${index}`}
                      feature={item.feature}
                      value={value}
                      maxValue={maxShap}
                    />
                  );
                })
              ) : (
                <div className="xai-empty">
                  No SHAP feature data available.
                </div>
              )}
            </div>

            <div className="xai-feature-summary">

              <div className="xai-summary-box">
                <span>FEATURES ANALYZED</span>
                <strong>
                  {explanation?.feature_count ??
                    features.length ??
                    0}
                </strong>
                <small>sensor inputs</small>
              </div>

              <div className="xai-summary-box">
                <span>TOP FEATURE</span>
                <strong>
                  {topFeatures[0]
                    ? sensorLabel(topFeatures[0].feature)
                    : "--"}
                </strong>
                <small>
                  {topFeatures[0]
                    ? `${formatNumber(
                        Number(
                          topFeatures[0].shap_value ??
                            topFeatures[0].contribution ??
                            0
                        ),
                        3
                      )} SHAP`
                    : "--"}
                </small>
              </div>

              <div className="xai-summary-box">
                <span>ANOMALY STATUS</span>
                <strong>
                  {state?.sensor_anomaly?.severity || "--"}
                </strong>
                <small>
                  Score{" "}
                  {formatNumber(
                    state?.sensor_anomaly?.score,
                    4
                  )}
                </small>
              </div>

            </div>
          </div>
        </div>
      </GlassCard>

      {/* ADDITIVE EXPLANATION */}
      <GlassCard>
        <div className="xai-card">

          <SectionHeader
            icon={TrendingUp}
            title="Prediction Decomposition"
            subtitle="SHAP additive explanation of the final RUL prediction."
          />

          <div className="xai-decomposition">

            <div className="xai-decomp-item">
              <span>BASE VALUE</span>
              <strong>{formatNumber(baseValue, 2)}</strong>
              <small>model baseline</small>
            </div>

            <div className="xai-decomp-symbol">+</div>

            <div className="xai-decomp-item">
              <span>SHAP CONTRIBUTION</span>
              <strong>
                {shapSum >= 0 ? "+" : ""}
                {formatNumber(shapSum, 2)}
              </strong>
              <small>feature contribution</small>
            </div>

            <div className="xai-decomp-symbol">=</div>

            <div className="xai-decomp-item highlight">
              <span>PREDICTED RUL</span>
              <strong>{formatNumber(reconstructed, 2)}</strong>
              <small>cycles</small>
            </div>

            <div className="xai-consistency">
              {predictionDifference < 0.01 ? (
                <>
                  <CheckCircle2 size={14} />
                  <span>Explanation consistent</span>
                </>
              ) : (
                <>
                  <Info size={14} />
                  <span>
                    Difference {formatNumber(predictionDifference, 3)}
                  </span>
                </>
              )}
            </div>

          </div>
        </div>
      </GlassCard>

      {/* CONTRIBUTOR CARDS */}
      <div className="xai-two-column">

        <GlassCard>
          <div className="xai-card">

            <SectionHeader
              icon={TrendingUp}
              title="Positive Contributors"
              subtitle="Features increasing the predicted RUL."
            />

            <div className="xai-contributor-list">
              {positive?.length ? (
                positive.map((item, index) => {
                  const value = Number(
                    item.shap_value ?? item.contribution ?? 0
                  );

                  return (
                    <div
                      className="xai-contributor"
                      key={`${item.feature}-${index}`}
                    >
                      <div className="xai-contributor-left">
                        <span className="xai-rank">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        <div>
                          <strong>
                            {sensorLabel(item.feature)}
                          </strong>

                          <small>
                            Value:{" "}
                            {formatNumber(
                              item.value ??
                                item.feature_value,
                              3
                            )}
                          </small>
                        </div>
                      </div>

                      <span className="xai-positive-value">
                        +{formatNumber(value, 3)}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="xai-empty">No positive contributors.</div>
              )}
            </div>

          </div>
        </GlassCard>

        <GlassCard>
          <div className="xai-card">

            <SectionHeader
              icon={TrendingDown}
              title="Negative Contributors"
              subtitle="Features decreasing the predicted RUL."
            />

            <div className="xai-contributor-list">
              {negative?.length ? (
                negative.map((item, index) => {
                  const value = Number(
                    item.shap_value ?? item.contribution ?? 0
                  );

                  return (
                    <div
                      className="xai-contributor"
                      key={`${item.feature}-${index}`}
                    >
                      <div className="xai-contributor-left">
                        <span className="xai-rank">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        <div>
                          <strong>
                            {sensorLabel(item.feature)}
                          </strong>

                          <small>
                            Value:{" "}
                            {formatNumber(
                              item.value ??
                                item.feature_value,
                              3
                            )}
                          </small>
                        </div>
                      </div>

                      <span className="xai-negative-value">
                        {formatNumber(value, 3)}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="xai-empty">No negative contributors.</div>
              )}
            </div>

          </div>
        </GlassCard>

      </div>

      {/* SENSOR MATRIX */}
      <GlassCard>
        <div className="xai-card">

          <SectionHeader
            icon={Cpu}
            title="Sensor Contribution Matrix"
            subtitle="Current sensor values and their influence on the prediction."
          />

          <div className="xai-table-wrap">
            <table className="xai-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Sensor</th>
                  <th>Current Value</th>
                  <th>SHAP Contribution</th>
                  <th>Influence</th>
                </tr>
              </thead>

              <tbody>
                {features.map((item, index) => {
                  const shap = Number(
                    item.shap_value ?? item.contribution ?? 0
                  );

                  return (
                    <tr key={`${item.feature}-${index}`}>
                      <td className="xai-table-index">
                        {String(index + 1).padStart(2, "0")}
                      </td>

                      <td>
                        <strong>
                          {sensorLabel(item.feature)}
                        </strong>
                      </td>

                      <td>
                        {formatNumber(
                          item.value ?? item.feature_value,
                          3
                        )}
                      </td>

                      <td
                        className={
                          shap >= 0
                            ? "positive-text"
                            : "negative-text"
                        }
                      >
                        {shap >= 0 ? "+" : ""}
                        {formatNumber(shap, 3)}
                      </td>

                      <td>
                        <span
                          className={`xai-influence ${
                            shap >= 0 ? "up" : "down"
                          }`}
                        >
                          {shap >= 0 ? "Positive" : "Negative"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      </GlassCard>

      {/* MODEL + ANOMALY */}
      <div className="xai-two-column">

        <GlassCard>
          <div className="xai-card">

            <SectionHeader
              icon={Gauge}
              title="Model Performance"
              subtitle="Evaluation metrics for the RUL prediction model."
            />

            <div className="xai-performance-grid">

              <Metric
                label="MAE"
                value={formatNumber(
                  metrics?.cmapss?.official_test_mae,
                  2
                )}
                sub="cycles"
              />

              <Metric
                label="RMSE"
                value={formatNumber(
                  metrics?.cmapss?.official_test_rmse,
                  2
                )}
                sub="cycles"
              />

              <Metric
                label="MODEL"
                value="RF"
                sub="regressor"
              />

            </div>

          </div>
        </GlassCard>

        <GlassCard>
          <div className="xai-card">

            <SectionHeader
              icon={ShieldCheck}
              title="Anomaly Detection"
              subtitle="Current sensor anomaly assessment."
            />

            <div className="xai-anomaly">

              <div
                className={`xai-anomaly-status ${healthClass(
                  state?.sensor_anomaly?.severity
                )}`}
              >
                {state?.sensor_anomaly?.severity === "NORMAL" ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <AlertTriangle size={18} />
                )}

                <div>
                  <strong>
                    {state?.sensor_anomaly?.severity || "--"}
                  </strong>

                  <span>
                    {state?.sensor_anomaly?.status || "--"}
                  </span>
                </div>
              </div>

              <div className="xai-anomaly-score">
                <span>Anomaly Score</span>
                <strong>
                  {formatNumber(
                    state?.sensor_anomaly?.score,
                    4
                  )}
                </strong>
              </div>

            </div>

          </div>
        </GlassCard>

      </div>

      {/* FOOTER */}
      <div className="xai-footer">
        <span>
          Explainability model:{" "}
          {explanation?.explanation_method ||
            "SHAP TreeExplainer"}
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