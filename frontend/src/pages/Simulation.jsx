import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import JetEngineModel from "../components/Engine3D";
import { simulationApi } from "../services/simulationApi";
import { api } from "../services/api";


const COLORS = {
  text: "#eafaff",
  muted: "#91a9c2",
  cyan: "#4dddf8",
  green: "#31d6a0",
  yellow: "#e9bd58",
  orange: "#ff9e45",
  red: "#ff5252",
  panel: "rgba(15, 29, 47, 0.88)",
  background: "#102334",
  border: "#28516a",
};


const panelStyle = {
  background: COLORS.panel,
  border: "1px solid rgba(77, 221, 248, 0.15)",
  borderRadius: 14,
  padding: 18,
};


const buttonStyle = {
  background: "#102b40",
  color: COLORS.text,
  border: "1px solid #28516a",
  padding: "9px 15px",
  borderRadius: 8,
  cursor: "pointer",
};


const statusColors = {
  HEALTHY: COLORS.green,
  MODERATE: COLORS.yellow,
  WARNING: COLORS.orange,
  CRITICAL: COLORS.red,
};


const CONTROLLED_SENSORS = [
  "sensor_11",
  "sensor_9",
  "sensor_4",
  "sensor_7",
  "sensor_12",
];


const SENSOR_LABELS = {
  sensor_11: "Sensor 11",
  sensor_9: "Sensor 9",
  sensor_4: "Sensor 4",
  sensor_7: "Sensor 7",
  sensor_12: "Sensor 12",
};


function MetricCard({
  label,
  value,
  suffix = "",
  color = COLORS.text,
}) {
  return (
    <div style={panelStyle}>
      <div
        style={{
          color: COLORS.muted,
          fontSize: 12,
          marginBottom: 10,
        }}
      >
        {label}
      </div>

      <div
        style={{
          color,
          fontSize: 25,
          fontWeight: 700,
        }}
      >
        {value ?? "--"}
        {suffix}
      </div>
    </div>
  );
}


function SectionTitle({ children, subtitle }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2
        style={{
          fontSize: 17,
          margin: 0,
          color: COLORS.text,
        }}
      >
        {children}
      </h2>

      {subtitle && (
        <p
          style={{
            color: COLORS.muted,
            fontSize: 12,
            marginTop: 7,
            lineHeight: 1.6,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}


function getSensorSeverity(value, range) {
  if (!range || !Number.isFinite(value)) {
    return "UNKNOWN";
  }

  if (
    value < range.criticalLow ||
    value > range.criticalHigh
  ) {
    return "CRITICAL";
  }

  if (
    value < range.warningLow ||
    value > range.warningHigh
  ) {
    return "WARNING";
  }

  return "NORMAL";
}


function severityColor(severity) {
  if (severity === "CRITICAL") return COLORS.red;
  if (severity === "WARNING") return COLORS.orange;
  if (severity === "NORMAL") return COLORS.green;

  return COLORS.muted;
}


function SensorControl({
  sensor,
  value,
  range,
  onChange,
}) {
  if (!range || !Number.isFinite(value)) {
    return null;
  }

  const severity = getSensorSeverity(value, range);

  const percentage =
    ((value - range.min) /
      Math.max(range.max - range.min, 0.000001)) *
    100;

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(77,221,248,0.12)",
        borderRadius: 10,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div>
          <strong style={{ color: COLORS.text }}>
            {SENSOR_LABELS[sensor] || sensor}
          </strong>

          <div
            style={{
              fontSize: 10,
              color: COLORS.muted,
              marginTop: 4,
            }}
          >
            C-MAPSS sensor feature
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontWeight: 700,
              color: COLORS.text,
            }}
          >
            {value.toFixed(4)}
          </div>

          <div
            style={{
              color: severityColor(severity),
              fontSize: 10,
              fontWeight: 700,
              marginTop: 4,
            }}
          >
            {severity}
          </div>
        </div>
      </div>

      <input
        type="range"
        min={range.min}
        max={range.max}
        step={Math.max(
          (range.max - range.min) / 500,
          0.0001
        )}
        value={value}
        onChange={(event) =>
          onChange(sensor, Number(event.target.value))
        }
        style={{
          width: "100%",
          accentColor: severityColor(severity),
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: COLORS.muted,
          marginTop: 6,
        }}
      >
        <span>Min: {range.min.toFixed(3)}</span>
        <span>Max: {range.max.toFixed(3)}</span>
      </div>

      <div
        style={{
          height: 5,
          background: "#253c51",
          borderRadius: 10,
          marginTop: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.min(
              100,
              Math.max(0, percentage)
            )}%`,
            background: severityColor(severity),
            borderRadius: 10,
          }}
        />
      </div>
    </div>
  );
}


function createFallbackRange(value) {
  const spread = Math.max(Math.abs(value) * 0.2, 0.1);

  return {
    min: value - spread,
    max: value + spread,
    warningLow: value - spread * 0.7,
    warningHigh: value + spread * 0.7,
    criticalLow: value - spread,
    criticalHigh: value + spread,
  };
}


export default function Simulation() {
  const [engines, setEngines] = useState([]);
  const [engineId, setEngineId] = useState(1);

  const [info, setInfo] = useState(null);
  const [state, setState] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [speed, setSpeed] = useState(1);

  const [sensorOverrides, setSensorOverrides] = useState({});
  const [sensorRanges, setSensorRanges] = useState({});

  const [activeScenario, setActiveScenario] = useState(null);

  const [shutdown, setShutdown] = useState(false);
  const [visualBlast, setVisualBlast] = useState(false);

  const [acoustic, setAcoustic] = useState(null);
  const [acousticLoading, setAcousticLoading] = useState(false);
  const [acousticError, setAcousticError] = useState("");

  const [acousticSample, setAcousticSample] = useState("4");
  const [blastTrigger, setBlastTrigger] = useState(0);
  const triggerVisualBlast = () => {
    setVisualBlast(true);
    setBlastTrigger((value) => value + 1);

    window.setTimeout(() => {
        setVisualBlast(false);
    }, 2800);
  };

  const pollingRef = useRef(false);


  const loadState = useCallback(async () => {
    if (pollingRef.current) return;

    pollingRef.current = true;

    try {
      const result = await simulationApi.state(engineId);

      setState(result);
      setError("");

      if (result.shutdown) {
        setShutdown(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      pollingRef.current = false;
    }
  }, [engineId]);


  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const engineResult = await api.getEngines();

        if (!active) return;

        const ids = engineResult.engines || [];

        setEngines(ids);

        const initialEngine = ids.includes(engineId)
          ? engineId
          : ids[0];

        if (!initialEngine) {
          throw new Error("No C-MAPSS engines found.");
        }

        setEngineId(initialEngine);

        const [infoResult, stateResult] = await Promise.all([
          simulationApi.info(initialEngine),
          simulationApi.state(initialEngine),
        ]);

        if (!active) return;

        setInfo(infoResult);
        setState(stateResult);

        const values = stateResult.sensor_values || {};

        const initialOverrides = {};

        CONTROLLED_SENSORS.forEach((sensor) => {
          if (values[sensor] !== undefined) {
            initialOverrides[sensor] = Number(values[sensor]);
          }
        });

        setSensorOverrides(initialOverrides);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, []);


  useEffect(() => {
    if (!engines.includes(engineId)) return;

    let active = true;

    async function changeEngine() {
      try {
        const [infoResult, stateResult] = await Promise.all([
          simulationApi.info(engineId),
          simulationApi.state(engineId),
        ]);

        if (!active) return;

        setInfo(infoResult);
        setState(stateResult);
        setActiveScenario(null);
        setShutdown(false);
        setVisualBlast(false);

        const values = stateResult.sensor_values || {};

        const initialOverrides = {};

        CONTROLLED_SENSORS.forEach((sensor) => {
          if (values[sensor] !== undefined) {
            initialOverrides[sensor] = Number(values[sensor]);
          }
        });

        setSensorOverrides(initialOverrides);
      } catch (err) {
        if (active) setError(err.message);
      }
    }

    changeEngine();

    return () => {
      active = false;
    };
  }, [engineId, engines]);


  useEffect(() => {
    const timer = setInterval(loadState, 700);

    return () => clearInterval(timer);
  }, [loadState]);


  // Use the sensor history endpoint to get real dataset-derived ranges.
  useEffect(() => {
    let active = true;

    async function loadRanges() {
      try {
        const result = await api.getSensors(engineId);

        if (!active) return;

        const history = result?.history || [];

        const collected = {};

        history.forEach((entry) => {
          const values = entry?.sensors || {};

          Object.entries(values).forEach(([sensor, value]) => {
            if (!CONTROLLED_SENSORS.includes(sensor)) return;

            const number = Number(value);

            if (!Number.isFinite(number)) return;

            if (!collected[sensor]) {
              collected[sensor] = [];
            }

            collected[sensor].push(number);
          });
        });

        const ranges = {};

        CONTROLLED_SENSORS.forEach((sensor) => {
          const values = collected[sensor];

          if (!values?.length) return;

          values.sort((a, b) => a - b);

          const percentile = (p) => {
            const index = Math.min(
              values.length - 1,
              Math.max(0, Math.floor(p * (values.length - 1)))
            );

            return values[index];
          };

          const q05 = percentile(0.05);
          const q25 = percentile(0.25);
          const q50 = percentile(0.5);
          const q75 = percentile(0.75);
          const q95 = percentile(0.95);

          const spread = Math.max(q75 - q25, 0.0001);

          ranges[sensor] = {
            min: q05,
            max: q95,
            warningLow: q25 - spread,
            warningHigh: q75 + spread,
            criticalLow: q05,
            criticalHigh: q95,
            median: q50,
          };
        });

        setSensorRanges(ranges);
      } catch (err) {
        console.warn("Could not load sensor reference ranges:", err);
      }
    }

    loadRanges();

    return () => {
      active = false;
    };
  }, [engineId]);


  const baselineValues = state?.sensor_values || {};

  const displayedSensors = useMemo(() => {
    const result = { ...baselineValues };

    Object.entries(sensorOverrides).forEach(([sensor, value]) => {
      result[sensor] = value;
    });

    return result;
  }, [baselineValues, sensorOverrides]);


  const currentStatus =
    state?.overall_status || "HEALTHY";

  const currentStatusColor =
    statusColors[currentStatus] || COLORS.green;

  const baseline = state?.baseline;


  const severitySummary = useMemo(() => {
    let warning = 0;
    let critical = 0;

    CONTROLLED_SENSORS.forEach((sensor) => {
      const value = displayedSensors[sensor];
      const range = sensorRanges[sensor];

      if (value === undefined || !range) return;

      const severity = getSensorSeverity(
        Number(value),
        range
      );

      if (severity === "WARNING") warning += 1;
      if (severity === "CRITICAL") critical += 1;
    });

    return { warning, critical };
  }, [displayedSensors, sensorRanges]);


  const visualSeverity =
    shutdown
      ? "SHUTDOWN"
      : severitySummary.critical > 0 ||
        currentStatus === "CRITICAL"
        ? "CRITICAL"
        : severitySummary.warning > 0 ||
          currentStatus === "WARNING"
          ? "WARNING"
          : currentStatus;


  async function perform(action) {
    try {
      setError("");

      const result = await action();

      setState(result);

      setShutdown(Boolean(result.shutdown));

      if (result.scenario) {
        setActiveScenario({
          name: result.scenario,
          shutdown: result.shutdown,
        });
      } else {
        setActiveScenario(null);
      }

      return result;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }


  function handleSensorChange(sensor, value) {
    setSensorOverrides((previous) => ({
      ...previous,
      [sensor]: value,
    }));
  }


  async function applyAllSensorOverrides() {
    const current = state?.sensor_values || {};

    const overrides = {};

    Object.entries(sensorOverrides).forEach(([sensor, value]) => {
      if (
        current[sensor] !== undefined &&
        Math.abs(Number(value) - Number(current[sensor])) > 0.0000001
      ) {
        overrides[sensor] = Number(value);
      }
    });

    if (!Object.keys(overrides).length) {
      setError("Adjust at least one sensor before applying a scenario.");
      return;
    }

    await perform(() =>
      simulationApi.scenario(
        engineId,
        "Multi-sensor what-if scenario",
        overrides,
        false
      )
    );
  }


  async function applyShutdown() {
    const result = await perform(() =>
      simulationApi.scenario(
        engineId,
        "Emergency shutdown",
        {},
        true
      )
    );

    if (result) {
      setShutdown(true);
    }
  }


  async function clearScenario() {
    const result = await perform(() =>
      simulationApi.clearScenario(engineId)
    );

    if (result) {
      setShutdown(false);
      setVisualBlast(false);
      setActiveScenario(null);

      const values = result.sensor_values || {};

      const restored = {};

      CONTROLLED_SENSORS.forEach((sensor) => {
        if (values[sensor] !== undefined) {
          restored[sensor] = Number(values[sensor]);
        }
      });

      setSensorOverrides(restored);
    }
  }


  async function resetSimulation() {
    const result = await perform(() =>
      simulationApi.reset(engineId)
    );

    if (result) {
      setShutdown(false);
      setVisualBlast(false);
      setActiveScenario(null);

      const values = result.sensor_values || {};

      const restored = {};

      CONTROLLED_SENSORS.forEach((sensor) => {
        if (values[sensor] !== undefined) {
          restored[sensor] = Number(values[sensor]);
        }
      });

      setSensorOverrides(restored);
    }
  }


  async function analyzeAcoustic() {
    setAcousticLoading(true);
    setAcousticError("");

    try {
      const result = await api.analyzeAudio({
        sample_id: String(acousticSample),
        microphone_channel: "mic1",
      });

      setAcoustic(result);
    } catch (err) {
      setAcousticError(err.message);
    } finally {
      setAcousticLoading(false);
    }
  }


  if (loading) {
    return (
      <div style={{ color: COLORS.text, padding: 25 }}>
        Loading simulation...
      </div>
    );
  }


  return (
    <div
      style={{
        padding: 24,
        color: COLORS.text,
        fontFamily: "inherit",
      }}
    >
      {/* HEADER */}
      <div style={{ marginBottom: 22 }}>
        <h1
          style={{
            fontSize: 25,
            fontWeight: 700,
            margin: 0,
          }}
        >
          Engine Simulation
        </h1>

        <p
          style={{
            color: COLORS.muted,
            fontSize: 13,
            marginTop: 8,
          }}
        >
          Dataset-driven engine playback, sensor manipulation
          and hypothetical fault scenarios.
        </p>
      </div>


      {error && (
        <div
          style={{
            background: "rgba(255,70,70,0.1)",
            border: "1px solid #ff5252",
            color: "#ff9292",
            padding: 12,
            borderRadius: 8,
            marginBottom: 18,
          }}
        >
          {error}
        </div>
      )}


      {/* PLAYBACK CONTROLS */}
      <div
        style={{
          ...panelStyle,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 15,
          }}
        >
          <div>
            <div
              style={{
                color: COLORS.muted,
                fontSize: 12,
                marginBottom: 7,
              }}
            >
              SELECT ENGINE
            </div>

            <select
              value={engineId}
              onChange={(event) =>
                setEngineId(Number(event.target.value))
              }
              style={{
                background: COLORS.background,
                color: "white",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: 10,
              }}
            >
              {engines.map((id) => (
                <option key={id} value={id}>
                  Engine {id}
                </option>
              ))}
            </select>
          </div>


          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <button
              style={buttonStyle}
              onClick={() =>
                perform(() =>
                  simulationApi.start(engineId, speed)
                )
              }
            >
              Start
            </button>

            <button
              style={buttonStyle}
              onClick={() =>
                perform(() =>
                  simulationApi.pause(engineId)
                )
              }
            >
              Pause
            </button>

            <button
              style={buttonStyle}
              onClick={() =>
                perform(() =>
                  simulationApi.resume(engineId)
                )
              }
            >
              Resume
            </button>

            <button
              style={buttonStyle}
              onClick={resetSimulation}
            >
              Reset
            </button>
          </div>
        </div>


        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 20,
            flexWrap: "wrap",
            color: COLORS.muted,
            fontSize: 13,
          }}
        >
          <div>
            Current cycle:{" "}
            <strong style={{ color: "white" }}>
              {state?.cycle ?? "--"}
            </strong>
            {" / "}
            {info?.last_cycle ?? "--"}
          </div>

          <div>
            Mode:{" "}
            <strong style={{ color: COLORS.cyan }}>
              {state?.simulation_mode || "DATASET_REPLAY"}
            </strong>
          </div>
        </div>


        <input
          type="range"
          min={info?.first_cycle || 1}
          max={info?.last_cycle || 2}
          value={state?.cycle || info?.first_cycle || 1}
          onChange={(event) =>
            perform(() =>
              simulationApi.cycle(
                engineId,
                Number(event.target.value)
              )
            )
          }
          style={{
            width: "100%",
            marginTop: 16,
            accentColor: COLORS.cyan,
          }}
        />


        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 18,
          }}
        >
          <span style={{ fontSize: 12, color: COLORS.muted }}>
            Playback speed
          </span>

          <input
            type="range"
            min="0.25"
            max="5"
            step="0.25"
            value={speed}
            onChange={(event) =>
              setSpeed(Number(event.target.value))
            }
            onMouseUp={() =>
              perform(() =>
                simulationApi.speed(engineId, speed)
              )
            }
            onTouchEnd={() =>
              perform(() =>
                simulationApi.speed(engineId, speed)
              )
            }
            style={{
              flex: 1,
              accentColor: COLORS.cyan,
            }}
          />

          <strong>{speed.toFixed(2)}x</strong>
        </div>
      </div>


      {/* 3D ENGINE */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <h2 style={{ fontSize: 17, margin: 0 }}>
            3D Engine Visualization
          </h2>

          <span
            style={{
              color: severityColor(
                visualSeverity === "SHUTDOWN"
                  ? "CRITICAL"
                  : visualSeverity
              ),
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {visualSeverity}
          </span>
        </div>

        <JetEngineModel
            engineState={{
                ...state,
                
                overall_status:
                visualSeverity === "SHUTDOWN"
                    ? "CRITICAL"
                    : visualSeverity,
                shutdown,
            }}
            isPlaying={Boolean(state?.playing)}
            scenario={{
                ...activeScenario,
                shutdown,
                severity: visualSeverity,
                visualBlast,
            }}
            sensorValues={displayedSensors}
            sensorSeverity={visualSeverity}
            blastTrigger={blastTrigger}
            simulationMode
        />
      </div>


      {/* METRICS */}
      <SectionTitle>Simulation Results</SectionTitle>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <MetricCard
          label="Predicted RUL"
          value={state?.predicted_rul?.toFixed(2)}
          suffix=" cycles"
        />

        <MetricCard
          label="Engine Health"
          value={state?.health_percentage?.toFixed(1)}
          suffix="%"
        />

        <MetricCard
          label="Anomaly Score"
          value={state?.sensor_anomaly_score?.toFixed(4)}
        />

        <MetricCard
          label="Overall ML Status"
          value={currentStatus}
          color={currentStatusColor}
        />
      </div>


      {/* SENSOR CONTROL PANEL */}
      <div style={{ ...panelStyle, marginBottom: 20 }}>
        <SectionTitle
          subtitle="Adjust sensor values and submit the modified inputs to the existing RUL and anomaly detection models."
        >
          Sensor Scenario Controls
        </SectionTitle>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 12,
          }}
        >
          {CONTROLLED_SENSORS.map((sensor) => {
            const baselineValue = Number(
              baselineValues[sensor]
            );

            const value =
              sensorOverrides[sensor] ??
              baselineValue;

            const range =
              sensorRanges[sensor] ||
              (
                Number.isFinite(baselineValue)
                  ? createFallbackRange(baselineValue)
                  : null
              );

            return (
              <SensorControl
                key={sensor}
                sensor={sensor}
                value={value}
                range={range}
                onChange={handleSensorChange}
              />
            );
          })}
        </div>


        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 10,
          }}
        >
          <button
            style={{
              ...buttonStyle,
              background: "#15546a",
              borderColor: COLORS.cyan,
            }}
            onClick={applyAllSensorOverrides}
          >
            Apply Sensor Scenario
          </button>

          <button
            style={buttonStyle}
            onClick={clearScenario}
          >
            Clear Scenario
          </button>
        </div>


        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            marginTop: 18,
            fontSize: 12,
          }}
        >
          <span style={{ color: COLORS.orange }}>
            Warning sensors: {severitySummary.warning}
          </span>

          <span style={{ color: COLORS.red }}>
            Critical sensors: {severitySummary.critical}
          </span>
        </div>
      </div>


      {/* EMERGENCY SCENARIOS */}
      <div style={{ ...panelStyle, marginBottom: 20 }}>
        <SectionTitle
          subtitle="Shutdown is a control scenario. The optional blast is a visual effect only, not an ML-predicted physical failure."
        >
          Emergency Scenarios
        </SectionTitle>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <button
            style={{
              ...buttonStyle,
              borderColor: COLORS.red,
              color: "#ff9292",
            }}
            onClick={applyShutdown}
          >
            Emergency Shutdown
          </button>

          <button
            style={{
              ...buttonStyle,
              borderColor: COLORS.orange,
              color: "#ffb36d",
            }}
            onClick={() => {
              setVisualBlast(true);

              window.setTimeout(() => {
                setVisualBlast(false);
              }, 3500);
            }}
          >
            Trigger Visual Blast
          </button>
        </div>

        {shutdown && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 8,
              background: "rgba(255,82,82,0.1)",
              border: "1px solid rgba(255,82,82,0.35)",
              color: "#ff9292",
              fontSize: 12,
            }}
          >
            ENGINE SHUTDOWN ACTIVE — playback stopped.
          </div>
        )}

        {activeScenario && (
          <div
            style={{
              color: COLORS.yellow,
              marginTop: 14,
              fontSize: 12,
            }}
          >
            Active scenario: {activeScenario.name}
          </div>
        )}
      </div>


      {/* ACOUSTIC ANALYSIS */}
      <div style={{ ...panelStyle, marginBottom: 20 }}>
        <SectionTitle
          subtitle="Acoustic inference is evaluated independently using the existing DGEN audio analysis endpoint."
        >
          Acoustic Anomaly Analysis
        </SectionTitle>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <select
            value={acousticSample}
            onChange={(event) =>
              setAcousticSample(event.target.value)
            }
            style={{
              background: COLORS.background,
              color: "white",
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              padding: 10,
            }}
          >
            {Array.from({ length: 20 }, (_, index) => (
              <option
                key={index + 1}
                value={String(index + 1)}
              >
                Acoustic Sample {index + 1}
              </option>
            ))}
          </select>

          <button
            style={buttonStyle}
            disabled={acousticLoading}
            onClick={analyzeAcoustic}
          >
            {acousticLoading
              ? "Analyzing..."
              : "Analyze Acoustic Sample"}
          </button>
        </div>

        {acousticError && (
          <p style={{ color: COLORS.red, fontSize: 12 }}>
            {acousticError}
          </p>
        )}

        {acoustic && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12,
              marginTop: 16,
            }}
          >
            <MetricCard
              label="Acoustic Condition"
              value={
                acoustic.acoustic_condition ||
                acoustic.audio_status ||
                "ANALYZED"
              }
            />

            <MetricCard
              label="Normal Probability"
              value={
                acoustic.probability_normal != null
                  ? (
                      Number(acoustic.probability_normal) *
                      100
                    ).toFixed(1)
                  : "--"
              }
              suffix="%"
            />

            <MetricCard
              label="Fault Score"
              value={
                acoustic.fault_score != null
                  ? Number(acoustic.fault_score).toFixed(4)
                  : "--"
              }
            />

            <div style={panelStyle}>
                <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10 }}>
                    Window Votes
                </div>

                <div style={{ color: COLORS.text, fontSize: 15, fontWeight: 700 }}>
                    Normal: {acoustic.window_votes?.normal ?? "--"}
                </div>

                <div style={{ color: COLORS.text, fontSize: 15, fontWeight: 700, marginTop: 6 }}>
                    Abnormal: {acoustic.window_votes?.abnormal ?? "--"}
                </div>
                </div>
          </div>
        )}
      </div>


      {/* BASELINE COMPARISON */}
      <div style={{ ...panelStyle, marginBottom: 20 }}>
        <SectionTitle>
          Baseline vs Scenario
        </SectionTitle>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 16,
          }}
        >
          <div>
            <div style={{ color: COLORS.muted, fontSize: 12 }}>
              Baseline RUL
            </div>

            <strong style={{ fontSize: 22 }}>
              {baseline?.predicted_rul?.toFixed(2) ?? "--"}
            </strong>
          </div>

          <div>
            <div style={{ color: COLORS.muted, fontSize: 12 }}>
              Current RUL
            </div>

            <strong style={{ fontSize: 22 }}>
              {state?.predicted_rul?.toFixed(2) ?? "--"}
            </strong>
          </div>

          <div>
            <div style={{ color: COLORS.muted, fontSize: 12 }}>
              RUL difference
            </div>

            <strong
              style={{
                fontSize: 22,
                color:
                  state && baseline &&
                  state.predicted_rul < baseline.predicted_rul
                    ? COLORS.red
                    : COLORS.green,
              }}
            >
              {baseline && state
                ? (
                    state.predicted_rul -
                    baseline.predicted_rul
                  ).toFixed(2)
                : "--"}
            </strong>
          </div>
        </div>
      </div>


      {/* SENSOR READINGS */}
      <div style={panelStyle}>
        <SectionTitle>
          Current Sensor Readings
        </SectionTitle>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 12,
          }}
        >
          {Object.entries(displayedSensors).map(
            ([name, value]) => {
              const modified =
                sensorOverrides[name] !== undefined &&
                Math.abs(
                  Number(sensorOverrides[name]) -
                  Number(baselineValues[name])
                ) > 0.000001;

              return (
                <div
                  key={name}
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    padding: 12,
                    borderRadius: 9,
                    border: modified
                      ? `1px solid ${COLORS.orange}`
                      : "1px solid transparent",
                  }}
                >
                  <div
                    style={{
                      color: COLORS.muted,
                      fontSize: 12,
                    }}
                  >
                    {name}
                  </div>

                  <div
                    style={{
                      color: modified
                        ? COLORS.orange
                        : COLORS.text,
                      fontSize: 17,
                      fontWeight: 700,
                      marginTop: 7,
                    }}
                  >
                    {Number(value).toFixed(4)}
                  </div>

                  {modified && (
                    <div
                      style={{
                        color: COLORS.orange,
                        fontSize: 10,
                        marginTop: 5,
                      }}
                    >
                      MODIFIED
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      </div>


      <p
        style={{
          color: "#718ba5",
          fontSize: 11,
          marginTop: 18,
          lineHeight: 1.6,
        }}
      >
        Source: NASA C-MAPSS FD001 test dataset.
        Dataset replay represents recorded degradation data.
        Sensor scenarios are hypothetical model inputs.
        Acoustic analysis uses a separate dataset and model.
        Visual effects do not represent validated physical engine behaviour.
      </p>
    </div>
  );
}