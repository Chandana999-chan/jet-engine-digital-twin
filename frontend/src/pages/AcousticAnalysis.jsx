import { useEffect, useState } from "react";
import { AudioWaveform, Volume2 } from "lucide-react";
import GlassCard from "../components/GlassCard";
import { api } from "../services/api";

export default function AcousticAnalysis() {
  const [samples, setSamples] = useState([]);
  const [selectedSample, setSelectedSample] = useState("");

  const [metadata, setMetadata] = useState(null);
  const [waveform, setWaveform] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // ---------------------------------------------------------
  // LOAD AVAILABLE SAMPLES
  // ---------------------------------------------------------

  useEffect(() => {
    loadSamples();
  }, []);

  async function loadSamples() {
    try {
      setLoading(true);
      setMessage("");

      const result = await api.getAudioSamples();

      const audioSamples = result?.samples || [];

      // Only use actual acoustic waveform recordings.
      // Excludes the small *_perfo_* metadata files.
      const realRecordings = audioSamples.filter(
        (sample) =>
          sample.name &&
          !sample.name.toLowerCase().includes("_perfo_")
      );

      setSamples(realRecordings);

      if (realRecordings.length > 0) {
        setSelectedSample(String(realRecordings[0].id));
      }
    } catch (error) {
      console.error("DGEN sample loading error:", error);

      setMessage(
        "Unable to load DGEN 380 samples from backend."
      );
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------
  // LOAD BACKEND DATA FOR SELECTED SAMPLE
  // ---------------------------------------------------------

  useEffect(() => {
    if (!selectedSample) {
      return;
    }

    loadSampleData(selectedSample);
  }, [selectedSample]);

  async function loadSampleData(sampleId) {
    try {
      setLoading(true);
      setMessage("");

      setMetadata(null);
      setWaveform(null);
      setAnalysis(null);

      // -----------------------------------------------------
      // METADATA
      // -----------------------------------------------------

      const metadataResult =
        await api.getAudioMetadata(sampleId);

      setMetadata(metadataResult);

      // -----------------------------------------------------
      // WAVEFORM
      // -----------------------------------------------------

      const channels =
        metadataResult?.microphone_channels || [];

      const channel =
        channels.length > 0
          ? channels[0]
          : "mic1";

      const waveformResult =
        await api.getWaveform(sampleId);

      setWaveform(waveformResult);

      // -----------------------------------------------------
      // ACOUSTIC CLASSIFICATION
      // -----------------------------------------------------

      const analysisResult =
        await api.analyzeAudio({
          sample_id: String(sampleId),
          microphone_channel: channel,
        });

      setAnalysis(analysisResult);
    } catch (error) {
      console.error(
        "DGEN backend error:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to load the selected DGEN 380 sample."
      );
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------
  // SELECTED SAMPLE
  // ---------------------------------------------------------

  const selectedSampleData =
    samples.find(
      (sample) =>
        String(sample.id) ===
        String(selectedSample)
    ) || null;

  // ---------------------------------------------------------
  // REAL BACKEND VALUES
  // ---------------------------------------------------------

  const recording =
    metadata?.recording ||
    selectedSampleData?.name ||
    "--";

  const knownLabel =
    metadata?.known_label ??
    selectedSampleData?.known_label ??
    "--";

  const configuration =
    metadata?.configuration ??
    selectedSampleData?.configuration ??
    "--";

  const runId =
    metadata?.run_id ??
    selectedSampleData?.run_id ??
    "--";

  const sampleRate =
    metadata?.sample_rate ??
    "--";

  const duration =
    metadata?.duration_seconds ??
    "--";

  const numberOfSamples =
    metadata?.num_samples ??
    "--";

  const microphoneChannels =
    metadata?.microphone_channels?.length
      ? metadata.microphone_channels.join(", ")
      : "--";

  const accelerometerChannels =
    metadata?.accelerometer_channels?.length
      ? metadata.accelerometer_channels.join(", ")
      : "--";

  // ---------------------------------------------------------
  // CLASSIFICATION VALUES
  // ---------------------------------------------------------

  /*
   * Backend response:
   *
   * acoustic_condition: "NORMAL"
   * audio_status: "NORMAL"
   * model_score_probability: 0.025774...
   * probability_normal: 0.974225...
   * fault_score: 0.025774...
   * window_votes:
   * {
   *   normal: 39,
   *   abnormal: 0
   * }
   */

  const acousticStatus =
    analysis?.acoustic_condition ??
    analysis?.audio_status ??
    "READY";

  const confidence =
    analysis?.probability_normal ??
    null;

  const faultType =
    analysis
      ? analysis?.acoustic_condition === "NORMAL"
        ? "None Detected"
        : analysis?.acoustic_condition ??
          "Unknown"
      : "Not analyzed";

  const modelScore =
    analysis?.model_score_probability ??
    null;

  const faultScore =
    analysis?.fault_score ??
    null;

  const normalVotes =
    analysis?.window_votes?.normal ??
    0;

  const abnormalVotes =
    analysis?.window_votes?.abnormal ??
    0;

  // ---------------------------------------------------------
  // WAVEFORM
  // ---------------------------------------------------------

  function getWaveformPath() {
    if (
      !waveform ||
      !Array.isArray(waveform.time) ||
      !Array.isArray(waveform.amplitude)
    ) {
      return "";
    }

    const count = Math.min(
      waveform.time.length,
      waveform.amplitude.length
    );

    if (count < 2) {
      return "";
    }

    const width = 1000;
    const height = 220;
    const padding = 10;

    const amplitudes =
      waveform.amplitude.slice(0, count);

    const times =
      waveform.time.slice(0, count);

    const minAmplitude =
      Math.min(...amplitudes);

    const maxAmplitude =
      Math.max(...amplitudes);

    const amplitudeRange =
      maxAmplitude - minAmplitude || 1;

    const minTime = times[0];

    const maxTime =
      times[count - 1] - minTime || 1;

    let path = "";

    for (let i = 0; i < count; i++) {
      const x =
        padding +
        ((times[i] - minTime) / maxTime) *
          (width - padding * 2);

      const normalized =
        (amplitudes[i] - minAmplitude) /
        amplitudeRange;

      const y =
        height -
        padding -
        normalized *
          (height - padding * 2);

      path +=
        i === 0
          ? `M ${x} ${y}`
          : ` L ${x} ${y}`;
    }

    return path;
  }

  const waveformPath =
    getWaveformPath();

  // ---------------------------------------------------------
  // FORMATTERS
  // ---------------------------------------------------------

  function display(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "--";
    }

    if (typeof value === "number") {
      return value.toLocaleString(
        undefined,
        {
          maximumFractionDigits: 3,
        }
      );
    }

    return String(value);
  }

  function displayDuration(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "--";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "--";
    }

    return `${number.toFixed(3)} s`;
  }

  function displayConfidence(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "--";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "--";
    }

    const percentage =
      number <= 1
        ? number * 100
        : number;

    return `${percentage.toFixed(2)}%`;
  }

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------

  return (
    <>
      {/* ---------------------------------------------------
          HEADER
      --------------------------------------------------- */}

      <div className="page-header">
        <div>
          <span className="eyebrow">
            MULTIMODAL ENGINE INTELLIGENCE
          </span>

          <h1>Acoustic Analysis</h1>

          <p>
            Engine sound-based fault and anomaly
            monitoring.
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------
          BACKEND ERROR
      --------------------------------------------------- */}

      {message && (
        <GlassCard>
          <div
            style={{
              padding: "10px 0",
              fontSize: "14px",
            }}
          >
            {message}
          </div>
        </GlassCard>
      )}

      {/* ---------------------------------------------------
          SAMPLE SELECTOR
      --------------------------------------------------- */}

      <GlassCard>
        <span className="eyebrow">
          DGEN 380 ACOUSTIC DATA
        </span>

        <h2>Audio Waveform</h2>

        <select
          value={selectedSample}
          onChange={(event) =>
            setSelectedSample(
              event.target.value
            )
          }
          disabled={loading}
        >
          {samples.map((sample) => (
            <option
              key={sample.id}
              value={sample.id}
            >
              {sample.name}
            </option>
          ))}
        </select>
      </GlassCard>

      {/* ---------------------------------------------------
          ORIGINAL TWO-COLUMN SECTION
      --------------------------------------------------- */}

      <div className="dashboard-grid two-column">

        {/* -------------------------------------------------
            WAVEFORM
        ------------------------------------------------- */}

        <GlassCard className="audio-visualizer">
          <AudioWaveform size={34} />

          <div className="waveform">

            {loading ? (
              <div
                style={{
                  width: "100%",
                  textAlign: "center",
                  padding: "40px 0",
                }}
              >
                Loading waveform...
              </div>
            ) : waveformPath ? (
              <svg
                viewBox="0 0 1000 220"
                width="100%"
                height="180"
                preserveAspectRatio="none"
              >
                <path
                  d={waveformPath}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            ) : (
              <div
                style={{
                  width: "100%",
                  textAlign: "center",
                  padding: "40px 0",
                }}
              >
                Waveform data unavailable
              </div>
            )}

          </div>

          <div className="audio-time">
            {waveform ? (
              <>
                {waveform.recording ||
                  recording}

                {" • "}

                {waveform.channel ||
                  "--"}

                {" • "}

                {waveform.time?.length ||
                  0} points
              </>
            ) : (
              "LIVE AUDIO STREAM"
            )}
          </div>
        </GlassCard>

        {/* -------------------------------------------------
            CLASSIFICATION
        ------------------------------------------------- */}

        <GlassCard>
          <span className="eyebrow">
            CLASSIFICATION RESULT
          </span>

          <h2>Acoustic Health</h2>

          <div className="audio-big-status">
            <Volume2 size={28} />

            <strong>
              {display(acousticStatus)}
            </strong>

            <span>
              Confidence:{" "}
              {displayConfidence(
                confidence
              )}
            </span>
          </div>

          <div className="metric-list">

            <div>
              <span>Detected Fault</span>

              <strong>
                {display(faultType)}
              </strong>
            </div>

            <div>
              <span>Model Score</span>

              <strong>
                {modelScore !== null
                  ? Number(
                      modelScore
                    ).toFixed(4)
                  : "--"}
              </strong>
            </div>

            <div>
              <span>Normal Probability</span>

              <strong>
                {displayConfidence(
                  confidence
                )}
              </strong>
            </div>

            <div>
              <span>Fault Score</span>

              <strong>
                {faultScore !== null
                  ? Number(
                      faultScore
                    ).toFixed(4)
                  : "--"}
              </strong>
            </div>

            <div>
              <span>Window Votes</span>

              <strong>
                {analysis
                  ? `${normalVotes} Normal / ${abnormalVotes} Abnormal`
                  : "--"}
              </strong>
            </div>

            <div>
              <span>Analysis Status</span>

              <strong>
                {analysis
                  ? "ANALYZED"
                  : "READY"}
              </strong>
            </div>

          </div>
        </GlassCard>
      </div>

      {/* ---------------------------------------------------
          AUDIO METADATA
      --------------------------------------------------- */}

      <GlassCard>
        <span className="eyebrow">
          AUDIO METADATA
        </span>

        <h2>Sample Information</h2>

        <div className="metric-list">

          <div>
            <span>Sample ID</span>

            <strong>
              {display(selectedSample)}
            </strong>
          </div>

          <div>
            <span>Recording</span>

            <strong>
              {display(recording)}
            </strong>
          </div>

          <div>
            <span>Known Label</span>

            <strong>
              {display(knownLabel)}
            </strong>
          </div>

          <div>
            <span>Configuration</span>

            <strong>
              {display(configuration)}
            </strong>
          </div>

          <div>
            <span>Run ID</span>

            <strong>
              {display(runId)}
            </strong>
          </div>

          <div>
            <span>Sampling Rate</span>

            <strong>
              {sampleRate !== "--"
                ? `${display(
                    sampleRate
                  )} Hz`
                : "--"}
            </strong>
          </div>

          <div>
            <span>Duration</span>

            <strong>
              {displayDuration(duration)}
            </strong>
          </div>

          <div>
            <span>Number Of Samples</span>

            <strong>
              {display(numberOfSamples)}
            </strong>
          </div>

          <div>
            <span>
              Microphone Channels
            </span>

            <strong>
              {display(
                microphoneChannels
              )}
            </strong>
          </div>

          <div>
            <span>
              Accelerometer Channels
            </span>

            <strong>
              {display(
                accelerometerChannels
              )}
            </strong>
          </div>

        </div>
      </GlassCard>

      {/* ---------------------------------------------------
          MULTIMODAL DIAGNOSTICS
      --------------------------------------------------- */}

      <GlassCard>
        <span className="eyebrow">
          MULTIMODAL DIAGNOSTICS
        </span>

        <h2>Acoustic Pipeline</h2>

        <div className="metric-list">

          <div>
            <span>Audio Dataset</span>

            <strong>
              DGEN 380
            </strong>
          </div>

          <div>
            <span>Waveform</span>

            <strong>
              {waveform
                ? "Available"
                : "Unavailable"}
            </strong>
          </div>

          <div>
            <span>Feature Extraction</span>

            <strong>
              Librosa
            </strong>
          </div>

          <div>
            <span>Acoustic Classifier</span>

            <strong>
              {analysis
                ? "Online"
                : "READY"}
            </strong>
          </div>

          <div>
            <span>Decision Fusion</span>

            <strong>
              Available
            </strong>
          </div>

        </div>
      </GlassCard>
    </>
  );
}