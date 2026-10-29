
import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Server,
  RefreshCw,
  Bell,
  ShieldCheck,
  Activity,
  Volume2,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Database,
} from "lucide-react";

import GlassCard from "../components/GlassCard";
import { api } from "../services/api";

import "./Settings.css";

const DEFAULT_SETTINGS = {
  engineId: 1,
  autoRefresh: true,
  refreshInterval: 5,

  notifications: true,
  anomalyAlerts: true,
  rulAlerts: true,
  acousticAlerts: true,
};

export default function Settings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const [backendStatus, setBackendStatus] = useState("CHECKING");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);

  const [engines, setEngines] = useState([]);
  const [engineState, setEngineState] = useState(null);
  const [metrics, setMetrics] = useState(null);

  const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:8000";

  useEffect(() => {
    const loadSettings = async () => {
      const storedSettings = localStorage.getItem(
        "jetEngineSettings"
      );

      if (storedSettings) {
        try {
          const parsed = JSON.parse(storedSettings);

          setSettings({
            ...DEFAULT_SETTINGS,
            ...parsed,
          });
        } catch (error) {
          console.error(
            "Unable to load saved settings:",
            error
          );
        }
      }
    };

    loadSettings();
    loadBackendData();
  }, []);

  useEffect(() => {
    if (!settings.engineId) return;

    loadEngineData(settings.engineId);
  }, [settings.engineId]);

  const loadBackendData = async () => {
    try {
      setChecking(true);

      const [enginesData, metricsData] =
        await Promise.all([
          api.getEngines(),
          api.getModelMetrics(),
        ]);

      const engineList = Array.isArray(enginesData)
        ? enginesData
        : enginesData?.engines || [];

      setEngines(engineList);
      setMetrics(metricsData);

      const connected = await api.healthCheck();

      setBackendStatus(
        connected ? "CONNECTED" : "OFFLINE"
      );
    } catch (error) {
      console.error(
        "Unable to load backend data:",
        error
      );

      setBackendStatus("OFFLINE");
    } finally {
      setChecking(false);
    }
  };

  const loadEngineData = async (engineId) => {
    try {
      const data = await api.getEngineState(engineId);

      setEngineState(data);
    } catch (error) {
      console.error(
        "Unable to load engine data:",
        error
      );

      setEngineState(null);
    }
  };

  const checkBackend = async () => {
    try {
      setChecking(true);

      const result = await api.healthCheck();

      setBackendStatus(
        result ? "CONNECTED" : "OFFLINE"
      );

      if (result) {
        const [metricsData] = await Promise.all([
          api.getModelMetrics(),
        ]);

        setMetrics(metricsData);

        await loadEngineData(settings.engineId);
      }
    } catch (error) {
      console.error(
        "Backend check failed:",
        error
      );

      setBackendStatus("OFFLINE");
    } finally {
      setChecking(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings((previous) => ({
      ...previous,
      [key]: value,
    }));

    setSaved(false);
  };

  const saveSettings = () => {
    setSaving(true);

    localStorage.setItem(
      "jetEngineSettings",
      JSON.stringify(settings)
    );

    setTimeout(() => {
      setSaving(false);
      setSaved(true);
    }, 500);
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);

    localStorage.setItem(
      "jetEngineSettings",
      JSON.stringify(DEFAULT_SETTINGS)
    );

    setSaved(true);
  };

  /*
   * Backend values
   */

  const rulMetrics = metrics?.cmapss || {};

  const anomalyMetrics =
    metrics?.sensor_anomaly || {};

  const anomalyThresholds =
    anomalyMetrics.severity_thresholds || {};

  const selectedEngine =
    engineState?.engine_id ?? settings.engineId;

  const predictedRul =
    engineState?.predicted_rul ?? "--";

  const healthState =
    engineState?.health_state ?? "--";

  const anomalySeverity =
    engineState?.sensor_anomaly?.severity ?? "--";

  const acousticModel =
    metrics?.acoustic?.model ||
    "RandomForestClassifier";

  const rulModel =
    rulMetrics.model ||
    "RandomForestRegressor";

  const anomalyModel =
    "Isolation Forest";

  const availableEngineCount =
    engines.length > 0
      ? engines.length
      : 100;

  return (
    <div className="settings-page">

      {/* ================= HEADER ================= */}

      <div className="settings-page-header">

        <div>
          <span className="settings-eyebrow">
            SYSTEM CONFIGURATION
          </span>

          <h1>Settings</h1>

          <p>
            Configure engine monitoring, backend connectivity,
            alerts and dashboard behaviour.
          </p>
        </div>

        <div className="settings-header-actions">

          <div
            className={`settings-status ${
              backendStatus === "CONNECTED"
                ? "connected"
                : backendStatus === "OFFLINE"
                ? "offline"
                : "checking"
            }`}
          >
            <span className="settings-status-dot" />

            <span>
              {backendStatus}
            </span>
          </div>

          <button
            className="settings-refresh-btn"
            onClick={checkBackend}
            disabled={checking}
            title="Check backend connection"
          >
            <RefreshCw
              size={14}
              className={
                checking
                  ? "settings-spin"
                  : ""
              }
            />
          </button>

        </div>
      </div>

      {/* ================= BACKEND ================= */}

      <GlassCard>
        <div className="settings-card">

          <div className="settings-section-header">

            <div className="settings-section-icon blue">
              <Server size={16} />
            </div>

            <div>
              <h2>Backend Connection</h2>

              <p>
                FastAPI backend connection used by the dashboard.
              </p>
            </div>

          </div>

          <div className="settings-info-grid">

            <div className="settings-info-item">

              <span>API STATUS</span>

              <div className="settings-value-row">

                {backendStatus === "CONNECTED" ? (
                  <CheckCircle2
                    size={16}
                    className="settings-good"
                  />
                ) : (
                  <AlertTriangle
                    size={16}
                    className="settings-danger"
                  />
                )}

                <strong>
                  {backendStatus}
                </strong>

              </div>

            </div>

            <div className="settings-info-item">

              <span>API ENDPOINT</span>

              <strong className="settings-code">
                {API_URL}
              </strong>

            </div>

            <div className="settings-info-item">

              <span>BACKEND</span>

              <strong>
                FastAPI
              </strong>

            </div>

            <div className="settings-info-item">

              <span>DATA SOURCE</span>

              <strong>
                NASA C-MAPSS FD001
              </strong>

            </div>

          </div>

        </div>
      </GlassCard>

      {/* ================= ENGINE ================= */}

      <GlassCard>
        <div className="settings-card">

          <div className="settings-section-header">

            <div className="settings-section-icon purple">
              <Cpu size={16} />
            </div>

            <div>
              <h2>Engine Configuration</h2>

              <p>
                Select the engine used for dashboard monitoring.
              </p>
            </div>

          </div>

          <div className="settings-form-grid">

            <div className="settings-field">

              <label>ENGINE ID</label>

              <select
                value={settings.engineId}
                onChange={(e) =>
                  updateSetting(
                    "engineId",
                    Number(e.target.value)
                  )
                }
              >
                {engines.length > 0 ? (
                  engines.map((engine) => {
                    const engineId =
                      typeof engine === "object"
                        ? engine.engine_id ??
                          engine.id
                        : engine;

                    return (
                      <option
                        key={engineId}
                        value={engineId}
                      >
                        Engine {engineId}
                      </option>
                    );
                  })
                ) : (
                  Array.from(
                    { length: 100 },
                    (_, index) => index + 1
                  ).map((id) => (
                    <option
                      key={id}
                      value={id}
                    >
                      Engine {id}
                    </option>
                  ))
                )}
              </select>

            </div>

            <div className="settings-field">

              <label>MONITORING MODE</label>

              <div className="settings-static-value">
                <Activity size={15} />
                Live Monitoring
              </div>

            </div>

          </div>

          <div className="settings-info-grid settings-engine-info">

            <div className="settings-info-item">

              <span>AVAILABLE ENGINES</span>

              <strong>
                {availableEngineCount}
              </strong>

            </div>

            <div className="settings-info-item">

              <span>SELECTED ENGINE</span>

              <strong>
                Engine {selectedEngine}
              </strong>

            </div>

            <div className="settings-info-item">

              <span>CURRENT RUL</span>

              <strong>
                {typeof predictedRul === "number"
                  ? `${predictedRul.toFixed(2)} cycles`
                  : predictedRul}
              </strong>

            </div>

            <div className="settings-info-item">

              <span>HEALTH STATE</span>

              <strong>
                {healthState}
              </strong>

            </div>

          </div>

        </div>
      </GlassCard>

      {/* ================= REFRESH ================= */}

      <GlassCard>
        <div className="settings-card">

          <div className="settings-section-header">

            <div className="settings-section-icon green">
              <RefreshCw size={16} />
            </div>

            <div>
              <h2>Dashboard Refresh</h2>

              <p>
                Configure how frequently dashboard data is updated.
              </p>
            </div>

          </div>

          <div className="settings-toggle-row">

            <div>
              <strong>
                Automatic Refresh
              </strong>

              <span>
                Automatically fetch updated backend data.
              </span>
            </div>

            <button
              className={`settings-toggle ${
                settings.autoRefresh
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                updateSetting(
                  "autoRefresh",
                  !settings.autoRefresh
                )
              }
            >
              <span />
            </button>

          </div>

          <div className="settings-field settings-refresh-field">

            <label>
              REFRESH INTERVAL
            </label>

            <div className="settings-static-value">
              <RefreshCw size={15} />

              {settings.refreshInterval} seconds

            </div>

            <small>
              Dashboard pages currently poll the backend
              every {settings.refreshInterval} seconds.
            </small>

          </div>

        </div>
      </GlassCard>

      {/* ================= ALERTS ================= */}

      <GlassCard>
        <div className="settings-card">

          <div className="settings-section-header">

            <div className="settings-section-icon orange">
              <Bell size={16} />
            </div>

            <div>
              <h2>Alert Configuration</h2>

              <p>
                Control which monitoring alerts are enabled.
              </p>
            </div>

          </div>

          <div className="settings-alert-grid">

            <div className="settings-toggle-row compact">

              <div className="settings-alert-info">

                <Bell size={16} />

                <div>
                  <strong>
                    Notifications
                  </strong>

                  <span>
                    Enable system notifications.
                  </span>
                </div>

              </div>

              <button
                className={`settings-toggle ${
                  settings.notifications
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  updateSetting(
                    "notifications",
                    !settings.notifications
                  )
                }
              >
                <span />
              </button>

            </div>

            <div className="settings-toggle-row compact">

              <div className="settings-alert-info">

                <ShieldCheck size={16} />

                <div>
                  <strong>
                    Sensor Anomaly Alerts
                  </strong>

                  <span>
                    Alert when unusual sensor behaviour is detected.
                  </span>
                </div>

              </div>

              <button
                className={`settings-toggle ${
                  settings.anomalyAlerts
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  updateSetting(
                    "anomalyAlerts",
                    !settings.anomalyAlerts
                  )
                }
              >
                <span />
              </button>

            </div>

            <div className="settings-toggle-row compact">

              <div className="settings-alert-info">

                <Activity size={16} />

                <div>
                  <strong>
                    RUL Alerts
                  </strong>

                  <span>
                    Alert when remaining useful life is low.
                  </span>
                </div>

              </div>

              <button
                className={`settings-toggle ${
                  settings.rulAlerts
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  updateSetting(
                    "rulAlerts",
                    !settings.rulAlerts
                  )
                }
              >
                <span />
              </button>

            </div>

            <div className="settings-toggle-row compact">

              <div className="settings-alert-info">

                <Volume2 size={16} />

                <div>
                  <strong>
                    Acoustic Alerts
                  </strong>

                  <span>
                    Enable acoustic diagnostic alerts.
                  </span>
                </div>

              </div>

              <button
                className={`settings-toggle ${
                  settings.acousticAlerts
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  updateSetting(
                    "acousticAlerts",
                    !settings.acousticAlerts
                  )
                }
              >
                <span />
              </button>

            </div>

          </div>

        </div>
      </GlassCard>

      {/* ================= RUL THRESHOLDS ================= */}

      <GlassCard>
        <div className="settings-card">

          <div className="settings-section-header">

            <div className="settings-section-icon blue">
              <Activity size={16} />
            </div>

            <div>
              <h2>RUL Thresholds</h2>

              <p>
                Thresholds used by the backend to classify engine health.
              </p>
            </div>

          </div>

          <div className="settings-threshold-grid">

            <div className="settings-field">

              <label>
                HEALTHY THRESHOLD
              </label>

              <div className="settings-static-value">
                <Activity size={15} />

                &gt; 80 cycles
              </div>

              <small>
                Backend health classification: HEALTHY
              </small>

            </div>

            <div className="settings-field">

              <label>
                MODERATE THRESHOLD
              </label>

              <div className="settings-static-value">
                <Activity size={15} />

                50–80 cycles
              </div>

              <small>
                Backend health classification: MODERATE
              </small>

            </div>

            <div className="settings-field">

              <label>
                WARNING THRESHOLD
              </label>

              <div className="settings-static-value">
                <Activity size={15} />

                20–50 cycles
              </div>

              <small>
                Backend health classification: WARNING
              </small>

            </div>

            <div className="settings-field">

              <label>
                CRITICAL THRESHOLD
              </label>

              <div className="settings-static-value">
                <AlertTriangle size={15} />

                ≤ 20 cycles
              </div>

              <small>
                Backend health classification: CRITICAL
              </small>

            </div>

          </div>

          <div className="settings-info-grid settings-threshold-info">

            <div className="settings-info-item">

              <span>RUL CAP</span>

              <strong>
                {rulMetrics.rul_cap ?? 125} cycles
              </strong>

            </div>

            <div className="settings-info-item">

              <span>MODEL</span>

              <strong>
                {rulModel}
              </strong>

            </div>

            <div className="settings-info-item">

              <span>MAE</span>

              <strong>
                {typeof rulMetrics.official_test_mae === "number"
                  ? rulMetrics.official_test_mae.toFixed(2)
                  : "--"}{" "}
                cycles
              </strong>

            </div>

            <div className="settings-info-item">

              <span>RMSE</span>

              <strong>
                {typeof rulMetrics.official_test_rmse === "number"
                  ? rulMetrics.official_test_rmse.toFixed(2)
                  : "--"}{" "}
                cycles
              </strong>

            </div>

          </div>

        </div>
      </GlassCard>

      {/* ================= ANOMALY ================= */}

      <GlassCard>
        <div className="settings-card">

          <div className="settings-section-header">

            <div className="settings-section-icon red">
              <ShieldCheck size={16} />
            </div>

            <div>
              <h2>
                Anomaly Thresholds
              </h2>

              <p>
                Isolation Forest anomaly severity thresholds.
              </p>
            </div>

          </div>

          <div className="settings-threshold-grid">

            <div className="settings-field">

              <label>
                NORMAL THRESHOLD
              </label>

              <div className="settings-static-value">
                <CheckCircle2 size={15} />

                ≥{" "}
                {typeof anomalyThresholds.NORMAL === "number"
                  ? anomalyThresholds.NORMAL.toFixed(3)
                  : "--"}
              </div>

              <small>
                Current backend calibrated threshold.
              </small>

            </div>

            <div className="settings-field">

              <label>
                SUSPICIOUS THRESHOLD
              </label>

              <div className="settings-static-value">
                <AlertTriangle size={15} />

                ≥{" "}
                {typeof anomalyThresholds.SUSPICIOUS === "number"
                  ? anomalyThresholds.SUSPICIOUS.toFixed(3)
                  : "--"}
              </div>

              <small>
                Current backend calibrated threshold.
              </small>

            </div>

            <div className="settings-field">

              <label>
                ANOMALOUS THRESHOLD
              </label>

              <div className="settings-static-value">
                <AlertTriangle size={15} />

                &lt;{" "}
                {typeof anomalyThresholds.ANOMALOUS === "number"
                  ? anomalyThresholds.ANOMALOUS.toFixed(3)
                  : "--"}
              </div>

              <small>
                Current backend calibrated threshold.
              </small>

            </div>

            <div className="settings-field">

              <label>
                CURRENT STATUS
              </label>

              <div className="settings-static-value">
                {anomalySeverity === "NORMAL" ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <AlertTriangle size={15} />
                )}

                {anomalySeverity}
              </div>

              <small>
                Current selected engine assessment.
              </small>

            </div>

          </div>

          <div className="settings-info-grid settings-threshold-info">

            <div className="settings-info-item">

              <span>
                CALIBRATION METHOD
              </span>

              <strong>
                {anomalyMetrics.threshold_method ||
                  "Percentile-based calibration"}
              </strong>

            </div>

            <div className="settings-info-item">

              <span>
                THRESHOLD VALUE
              </span>

              <strong>
                {typeof anomalyMetrics.threshold_value === "number"
                  ? anomalyMetrics.threshold_value.toFixed(4)
                  : "--"}
              </strong>

            </div>

            <div className="settings-info-item">

              <span>
                PRECISION
              </span>

              <strong>
                {typeof anomalyMetrics.calibration_results?.precision ===
                "number"
                  ? (
                      anomalyMetrics.calibration_results
                        .precision * 100
                    ).toFixed(2) + "%"
                  : "--"}
              </strong>

            </div>

            <div className="settings-info-item">

              <span>
                RECALL
              </span>

              <strong>
                {typeof anomalyMetrics.calibration_results?.recall ===
                "number"
                  ? (
                      anomalyMetrics.calibration_results
                        .recall * 100
                    ).toFixed(2) + "%"
                  : "--"}
              </strong>

            </div>

          </div>

        </div>
      </GlassCard>

      {/* ================= SYSTEM INFO ================= */}

      <GlassCard>
        <div className="settings-card">

          <div className="settings-section-header">

            <div className="settings-section-icon cyan">
              <Database size={16} />
            </div>

            <div>
              <h2>
                System Information
              </h2>

              <p>
                Current digital twin system configuration.
              </p>
            </div>

          </div>

          <div className="settings-info-grid">

            <div className="settings-info-item">

              <span>
                RUL MODEL
              </span>

              <strong>
                {rulModel}
              </strong>

            </div>

            <div className="settings-info-item">

              <span>
                ANOMALY MODEL
              </span>

              <strong>
                {anomalyModel}
              </strong>

            </div>

            <div className="settings-info-item">

              <span>
                ACOUSTIC MODEL
              </span>

              <strong>
                {acousticModel}
              </strong>

            </div>

            <div className="settings-info-item">

              <span>
                RUL FEATURES
              </span>

              <strong>
                {rulMetrics.selected_sensors?.length || 14} Sensors
              </strong>

            </div>

            <div className="settings-info-item">

              <span>
                DATASET
              </span>

              <strong>
                NASA C-MAPSS FD001
              </strong>

            </div>

            <div className="settings-info-item">

              <span>
                FUSION
              </span>

              <strong>
                {metrics?.fusion?.method ||
                  "Decision-Level Fusion"}
              </strong>

            </div>

          </div>

        </div>
      </GlassCard>

      {/* ================= ACTIONS ================= */}

      <div className="settings-actions">

        <button
          className="settings-reset-btn"
          onClick={resetSettings}
        >
          <RotateCcw size={15} />
          Reset
        </button>

        <button
          className="settings-save-btn"
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? (
            <>
              <RefreshCw
                size={15}
                className="settings-spin"
              />
              Saving...
            </>
          ) : (
            <>
              <Save size={15} />

              {saved
                ? "Saved"
                : "Save Settings"}
            </>
          )}
        </button>

      </div>

      {/* ================= FOOTER ================= */}

      <div className="settings-footer">

        <span>
          Jet Engine Digital Twin
        </span>

        <span>
          Backend values • Local dashboard preferences
        </span>

      </div>

    </div>
  );
}

