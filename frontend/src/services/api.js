const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const SELECTED_ENGINE_KEY = "selectedEngineId";
const ENGINE_CHANGE_EVENT = "engine-selection-changed";

/* =========================================================
   SELECTED ENGINE MANAGEMENT
========================================================= */

function getStoredEngineId() {
  const stored = localStorage.getItem(SELECTED_ENGINE_KEY);
  const parsed = Number(stored);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function getSelectedEngineId() {
  return getStoredEngineId();
}

function setSelectedEngineId(engineId) {
  const id = Number(engineId);

  if (!Number.isFinite(id) || id <= 0) {
    return;
  }

  localStorage.setItem(SELECTED_ENGINE_KEY, String(id));

  window.dispatchEvent(
    new CustomEvent(ENGINE_CHANGE_EVENT, {
      detail: {
        engineId: id,
      },
    })
  );
}

/* =========================================================
   API REQUEST
========================================================= */

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

/* =========================================================
   ENGINE ID NORMALIZATION
========================================================= */

/*
  Your existing pages currently use:

      api.getEngineState(1)

  api.getEngineHistory(1)
  api.getSensors(1)

  We don't want you to edit every page.

  Therefore, when a page passes 1, we automatically replace it
  with the engine selected in the Topbar.

  If another engine ID is explicitly required internally,
  it can still be used normally.
*/

function resolveEngineId(engineId) {
  const numericId = Number(engineId);

  if (!Number.isFinite(numericId) || numericId <= 0) {
    return getSelectedEngineId();
  }

  if (numericId === 1) {
    return getSelectedEngineId();
  }

  return numericId;
}

/* =========================================================
   API
========================================================= */

export const api = {
  /* -------------------------------------------------------
     ENGINE SELECTION
  ------------------------------------------------------- */

  getSelectedEngineId,

  setSelectedEngineId,

  onEngineChange(callback) {
    const handler = (event) => {
      callback(event.detail?.engineId);
    };

    window.addEventListener(
      ENGINE_CHANGE_EVENT,
      handler
    );

    return () => {
      window.removeEventListener(
        ENGINE_CHANGE_EVENT,
        handler
      );
    };
  },

  /* -------------------------------------------------------
     HEALTH
  ------------------------------------------------------- */

  healthCheck: async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/health`,
        {
          cache: "no-store",
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  },

  /* -------------------------------------------------------
     ENGINES
  ------------------------------------------------------- */

  getEngines: () => request("/engines"),

  /* -------------------------------------------------------
     ENGINE STATE
  ------------------------------------------------------- */

  getEngineState: (engineId = 1) =>
    request(
      `/engine/${resolveEngineId(engineId)}/state`
    ),

  /* -------------------------------------------------------
     ENGINE HISTORY
  ------------------------------------------------------- */

  getEngineHistory: (engineId = 1) =>
    request(
      `/engine/${resolveEngineId(engineId)}/history`
    ),

  /* -------------------------------------------------------
     SENSOR DATA
  ------------------------------------------------------- */

  getSensors: (engineId = 1) =>
    request(
      `/engine/${resolveEngineId(engineId)}/sensors`
    ),

  /* -------------------------------------------------------
     AUDIO
  ------------------------------------------------------- */

  getAudioSamples: () =>
    request("/audio/samples"),

  getAudioMetadata: (sampleId) =>
    request(
      `/audio/sample/${sampleId}/metadata`
    ),

  getWaveform: (sampleId) =>
    request(
      `/audio/sample/${sampleId}/waveform`
    ),

  getSpectrogram: (sampleId) =>
    request(
      `/audio/sample/${sampleId}/spectrogram`
    ),

  analyzeAudio: (data) =>
    request("/audio/analyze", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /* -------------------------------------------------------
     FUSION
  ------------------------------------------------------- */

  analyzeFusion: (data) =>
    request("/fusion/analyze", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /* -------------------------------------------------------
     MODEL METRICS
  ------------------------------------------------------- */

  getModelMetrics: () =>
    request("/models/metrics"),

  /* -------------------------------------------------------
     DASHBOARD
  ------------------------------------------------------- */

  getDashboard: async () => {
    const engineId = getSelectedEngineId();

    const [
      state,
      historyResponse,
      sensorsResponse,
    ] = await Promise.all([
      request(`/engine/${engineId}/state`),
      request(`/engine/${engineId}/history`),
      request(`/engine/${engineId}/sensors`),
    ]);

    /*
      Acoustic data is intentionally kept separate.

      The dashboard can display acoustic status when an
      analysis is available.
    */

    let acoustic = {
      status: "READY",
      confidence: null,
      modelScore: null,
      faultScore: null,
      probabilityNormal: null,
      windowVotes: null,
    };

    try {
      const audioResponse = await request(
        "/audio/analyze",
        {
          method: "POST",
          body: JSON.stringify({
            sample_id: "4",
            microphone_channel: "mic1",
          }),
        }
      );

      const probabilityNormal =
        audioResponse?.probability_normal;

      acoustic = {
        status:
          audioResponse?.acoustic_condition ||
          audioResponse?.audio_status ||
          "READY",

        confidence:
          probabilityNormal != null
            ? Number(probabilityNormal) * 100
            : null,

        modelScore:
          audioResponse?.model_score_probability ??
          null,

        faultScore:
          audioResponse?.fault_score ??
          null,

        probabilityNormal:
          probabilityNormal ??
          null,

        windowVotes:
          audioResponse?.window_votes ??
          null,
      };
    } catch (error) {
      console.error(
        "Acoustic dashboard analysis error:",
        error
      );
    }

    return {
      engine: state,

      history:
        Array.isArray(historyResponse?.history)
          ? historyResponse.history
          : [],

      sensorHistory:
        Array.isArray(sensorsResponse?.history)
          ? sensorsResponse.history
          : [],

      sensors:
        sensorsResponse?.history?.length > 0
          ? sensorsResponse.history[
              sensorsResponse.history.length - 1
            ]?.sensors || {}
          : {},

      alerts: [],

      acoustic,
    };
  },

  /* -------------------------------------------------------
     PREDICTION
  ------------------------------------------------------- */

  getPrediction: () =>
    request(
      `/engine/${getSelectedEngineId()}/state`
    ),

  /* -------------------------------------------------------
     ALERTS
  ------------------------------------------------------- */

  getAlerts: async () => {
    const engineId = getSelectedEngineId();

    try {
      const state = await request(
        `/engine/${engineId}/state`
      );

      const alerts = [];

      const healthState =
        state?.health_state || "UNKNOWN";

      const overallStatus =
        state?.overall_status ||
        healthState ||
        "UNKNOWN";

      const predictedRul =
        Number(state?.predicted_rul);

      const anomalySeverity =
        state?.sensor_anomaly?.severity ||
        state?.sensor_anomaly?.status ||
        "NORMAL";

      const anomalyScore =
        Number(state?.sensor_anomaly?.score);

      const engineLabel =
        `ENG-${String(engineId).padStart(3, "0")}`;

      /* =====================================================
        CRITICAL CONDITION
      ===================================================== */

      if (
        overallStatus === "CRITICAL" ||
        healthState === "CRITICAL" ||
        anomalySeverity === "ANOMALOUS"
      ) {
        alerts.push({
          id: `${engineId}-critical`,
          severity: "critical",
          title: "Critical Engine Condition",
          message:
            `${engineLabel} has entered a critical condition.` +
            (
              Number.isFinite(predictedRul)
                ? ` Predicted RUL: ${predictedRul.toFixed(1)} cycles.`
                : ""
            ),
          time: "Current",
          engineId,
        });
      }

      /* =====================================================
        WARNING CONDITION
      ===================================================== */

      else if (
        overallStatus === "WARNING" ||
        healthState === "WARNING" ||
        anomalySeverity === "SUSPICIOUS"
      ) {
        alerts.push({
          id: `${engineId}-warning`,
          severity: "warning",
          title: "Engine Condition Warning",
          message:
            `${engineLabel} has detected unusual engine behavior.` +
            (
              Number.isFinite(anomalyScore)
                ? ` Anomaly score: ${anomalyScore.toFixed(3)}.`
                : ""
            ),
          time: "Current",
          engineId,
        });
      }

      /* =====================================================
        MODERATE CONDITION
      ===================================================== */

      else if (
        overallStatus === "MODERATE" ||
        healthState === "MODERATE"
      ) {
        alerts.push({
          id: `${engineId}-moderate`,
          severity: "warning",
          title: "Engine Health Monitoring",
          message:
            `${engineLabel} is in a moderate health state.` +
            (
              Number.isFinite(predictedRul)
                ? ` Predicted RUL: ${predictedRul.toFixed(1)} cycles.`
                : ""
            ),
          time: "Current",
          engineId,
        });
      }

      /* =====================================================
        NORMAL CONDITION
      ===================================================== */

      else {
        alerts.push({
          id: `${engineId}-healthy`,
          severity: "info",
          title: "Engine Operating Normally",
          message:
            `${engineLabel} is operating within the current healthy range.` +
            (
              Number.isFinite(predictedRul)
                ? ` Predicted RUL: ${predictedRul.toFixed(1)} cycles.`
                : ""
            ),
          time: "Current",
          engineId,
        });
      }

      return alerts;

    } catch (error) {
      console.error(
        "Failed to load engine alerts:",
        error
      );

      return [
        {
          id: `${engineId}-connection`,
          severity: "warning",
          title: "Monitoring Connection Issue",
          message:
            "Unable to retrieve the latest engine condition from the backend.",
          time: "Current",
          engineId,
        },
      ];
    }
  },

  /* -------------------------------------------------------
     MAINTENANCE
  ------------------------------------------------------- */

  getMaintenance: async () => {
    const engineId = getSelectedEngineId();

    const state = await request(
      `/engine/${engineId}/state`
    );

    return {
      recommendation:
        state.maintenance_recommendation,

      healthState:
        state.health_state,

      predictedRul:
        state.predicted_rul,

      overallStatus:
        state.overall_status,

      engineId,
    };
  },

  /* -------------------------------------------------------
     EXPLAINABLE AI
  ------------------------------------------------------- */

  getExplanation: (
    engineId = 1,
    cycle = null
  ) => {
    const resolvedId =
      resolveEngineId(engineId);

    const endpoint =
      cycle !== null
        ? `/engine/${resolvedId}/explanation?cycle=${cycle}`
        : `/engine/${resolvedId}/explanation`;

    return request(endpoint);
  },
};