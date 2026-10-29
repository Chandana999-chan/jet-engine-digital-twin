"""FastAPI backend for Member 3 audio/vibration and integration work."""

import json
import sys

from functools import lru_cache
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import shap
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from src import (  # noqa: E402
    anomaly_detection,
    audio_inference,
    audio_processing,
    digital_twin,
    fusion,
    preprocessing,
    rul_prediction,
)
from src.config import (  # noqa: E402
    ANOMALY_THRESHOLD,
    IMPORTANT_SENSORS,
    MODEL_CONFIG_PATH,
    OFFICIAL_TEST_MAE,
    OFFICIAL_TEST_RMSE,
    RUL_CAP,
    SELECTED_SENSORS,
)


app = FastAPI(
    title="Jet Engine Digital Twin Backend",
    description=(
        "FastAPI integration layer for C-MAPSS sensor digital twin outputs, "
        "DGEN 380 acoustic diagnostics, and decision-level multimodal fusion."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AudioAnalyzeRequest(BaseModel):
    sample_id: str = Field(..., description="DGEN sample filename or zero-based sample index")
    microphone_channel: str = Field("mic1", description="Preferred microphone channel")


class FusionAnalyzeRequest(BaseModel):
    engine_id: int = Field(..., ge=1)
    cycle: Optional[int] = Field(None, ge=1)
    audio_sample_id: Optional[str] = Field(None, description="Optional DGEN sample filename or index")
    microphone_channel: str = Field("mic1")


def json_safe(value):
    """Convert values to API-safe JSON primitives."""
    return audio_inference.make_json_serializable(value)


@lru_cache(maxsize=1)
def load_sensor_assets():
    """Load C-MAPSS models and test data once."""
    return {
        "rul_model": rul_prediction.load_rul_model(),
        "anomaly_model": anomaly_detection.load_anomaly_model(),
        "test_data": preprocessing.load_test_data(),
        "test_rul_truth": preprocessing.load_rul_truth(),
    }

@lru_cache(maxsize=1)
def load_shap_explainer():
    """Create and cache a SHAP TreeExplainer for the Random Forest RUL model."""
    assets = load_sensor_assets()
    return shap.TreeExplainer(assets["rul_model"])


@lru_cache(maxsize=1)
def load_acoustic_assets():
    """Load acoustic model assets once."""
    return audio_inference.load_acoustic_assets()


def get_engine_data(engine_id: int) -> pd.DataFrame:
    """Return all C-MAPSS test rows for one engine."""
    assets = load_sensor_assets()
    test_data = assets["test_data"]
    engine_data = test_data[test_data["engine_id"] == engine_id]
    if engine_data.empty:
        raise HTTPException(status_code=404, detail=f"Engine {engine_id} not found")
    return engine_data


@lru_cache(maxsize=4096)
def create_sensor_state(engine_id: int, cycle: Optional[int] = None):
    """Create a C-MAPSS sensor digital twin state for latest or requested cycle."""
    assets = load_sensor_assets()
    engine_data = get_engine_data(engine_id)

    if cycle is None:
        row = engine_data.iloc[-1]
    else:
        matched = engine_data[engine_data["cycle"] == cycle]
        if matched.empty:
            raise HTTPException(status_code=404, detail=f"Cycle {cycle} not found for engine {engine_id}")
        row = matched.iloc[-1]

    features = pd.DataFrame([row[SELECTED_SENSORS].to_dict()], columns=SELECTED_SENSORS)
    predicted_rul = float(rul_prediction.predict_rul(assets["rul_model"], features)[0])
    anomaly_score = float(anomaly_detection.calculate_anomaly_score(assets["anomaly_model"], features)[0])
    anomaly_status = anomaly_detection.get_anomaly_status(anomaly_score, ANOMALY_THRESHOLD)
    anomaly_severity = anomaly_detection.get_anomaly_severity(anomaly_score)

    test_rul_truth = assets["test_rul_truth"]
    actual_rul = int(test_rul_truth[engine_id - 1]) if test_rul_truth is not None else None

    state = {
        "engine_id": int(engine_id),
        "cycle": int(row["cycle"]),
        **json_safe(
            digital_twin.create_digital_twin_state(
                engine_id=engine_id,
                current_cycle=int(row["cycle"]),
                predicted_rul=predicted_rul,
                anomaly_score=anomaly_score,
                anomaly_status=anomaly_status,
                anomaly_severity=anomaly_severity,
                actual_rul=actual_rul,
            )
        ),
    }
    return json_safe(state)


def get_sample_path(sample_id: str) -> Path:
    """Resolve a DGEN sample by filename or zero-based index."""
    recordings = audio_inference.discover_dgen_recordings()
    if not recordings:
        raise HTTPException(status_code=404, detail="No DGEN 380 samples found")

    if sample_id.isdigit():
        index = int(sample_id)
        if 0 <= index < len(recordings):
            return recordings[index]
        raise HTTPException(status_code=404, detail=f"Audio sample index {index} not found")

    sample_name = Path(sample_id).name
    for path in recordings:
        if path.name.lower() == sample_name.lower():
            return path
    raise HTTPException(status_code=404, detail=f"Audio sample {sample_id} not found")


@lru_cache(maxsize=12)
def load_recording(sample_name: str):
    """Load and cache DGEN MAT data by filename."""
    path = get_sample_path(sample_name)
    return audio_inference.load_recording_metadata(path)


def metadata_response(path: Path):
    """Return verified metadata without raw signal arrays."""
    metadata = load_recording(path.name)
    return json_safe({
        "recording": metadata["filename"],
        "known_label": metadata.get("known_label"),
        "configuration": metadata.get("configuration"),
        "run_id": metadata.get("run_id"),
        "sample_rate": metadata.get("sampling_rate"),
        "duration_seconds": metadata.get("duration"),
        "num_samples": metadata.get("num_samples"),
        "microphone_channels": metadata.get("microphone_channels", []),
        "accelerometer_channels": sorted(metadata["loaded_data"].get("accelerometer_signals", {}).keys()),
        "parameters": metadata["loaded_data"].get("parameters", ""),
    })


@app.get("/", summary="Backend information")
def root():
    return {
        "service": "Jet Engine Digital Twin Backend",
        "status": "ok",
        "docs": "/docs",
        "note": "C-MAPSS and DGEN 380 are independent datasets; fusion is decision-level only.",
    }


@app.get("/health", summary="Health check")
def health():
    return {"status": "ok"}


@app.get("/engines", summary="List available C-MAPSS engine IDs")
def list_engines():
    test_data = load_sensor_assets()["test_data"]
    return {"engines": [int(x) for x in sorted(test_data["engine_id"].unique())]}


@app.get("/engine/{engine_id}/state", summary="Return C-MAPSS sensor digital twin state")
def engine_state(engine_id: int, cycle: Optional[int] = Query(None, ge=1)):
    state = create_sensor_state(engine_id, cycle)
    return {
        "engine_id": state["engine_id"],
        "cycle": state["current_cycle"],
        "predicted_rul": state["predicted_rul"],
        "health_percentage": state["health_percentage"],
        "health_state": state["health_state"],
        "sensor_anomaly": {
            "status": state["sensor_anomaly_status"],
            "severity": state["sensor_anomaly_severity"],
            "score": state["sensor_anomaly_score"],
        },
        "overall_status": state["overall_status"],
        "maintenance_recommendation": state["maintenance_recommendation"],
    }


@app.get("/engine/{engine_id}/history", summary="Return cycle-wise C-MAPSS state history")
def engine_history(engine_id: int):
    assets = load_sensor_assets()
    engine_data = get_engine_data(engine_id)
    features = engine_data[SELECTED_SENSORS]
    predicted_ruls = rul_prediction.predict_rul(assets["rul_model"], features)
    anomaly_scores = anomaly_detection.calculate_anomaly_score(assets["anomaly_model"], features)

    history = []
    for (_, row), predicted_rul, anomaly_score in zip(engine_data.iterrows(), predicted_ruls, anomaly_scores):
        anomaly_status = anomaly_detection.get_anomaly_status(float(anomaly_score), ANOMALY_THRESHOLD)
        anomaly_severity = anomaly_detection.get_anomaly_severity(float(anomaly_score))
        history.append(json_safe(digital_twin.create_digital_twin_state(
            engine_id=engine_id,
            current_cycle=int(row["cycle"]),
            predicted_rul=float(predicted_rul),
            anomaly_score=float(anomaly_score),
            anomaly_status=anomaly_status,
            anomaly_severity=anomaly_severity,
        )))

    slim_history = [
        {
            "cycle": row["current_cycle"],
            "predicted_rul": row["predicted_rul"],
            "health_percentage": row["health_percentage"],
            "health_state": row["health_state"],
            "overall_status": row["overall_status"],
        }
        for row in history
    ]
    return {"engine_id": int(engine_id), "history": slim_history}


@app.get("/engine/{engine_id}/sensors", summary="Return C-MAPSS sensor trend data")
def engine_sensors(engine_id: int, sensors: Optional[str] = None):
    engine_data = get_engine_data(engine_id)
    selected = IMPORTANT_SENSORS if sensors is None else [s.strip() for s in sensors.split(",") if s.strip()]
    invalid = [sensor for sensor in selected if sensor not in SELECTED_SENSORS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unsupported sensor(s): {', '.join(invalid)}")

    rows = []
    for _, row in engine_data[["cycle"] + selected].iterrows():
        rows.append({"cycle": int(row["cycle"]), "sensors": {sensor: float(row[sensor]) for sensor in selected}})
    return {"engine_id": int(engine_id), "sensors": selected, "history": rows}

@app.get(
    "/engine/{engine_id}/explanation",
    summary="Return SHAP explanation for the current RUL prediction",
)
def engine_explanation(
    engine_id: int,
    cycle: Optional[int] = Query(None, ge=1),
):
    """
    Return real SHAP feature contributions for the Random Forest RUL model.

    The explanation is calculated for the latest engine cycle unless
    a specific cycle is requested.
    """
    assets = load_sensor_assets()
    engine_data = get_engine_data(engine_id)

    if cycle is None:
        row = engine_data.iloc[-1]
    else:
        matched = engine_data[engine_data["cycle"] == cycle]

        if matched.empty:
            raise HTTPException(
                status_code=404,
                detail=f"Cycle {cycle} not found for engine {engine_id}",
            )

        row = matched.iloc[-1]

    # Build exactly the same feature vector used by the RUL model.
    features = pd.DataFrame(
        [row[SELECTED_SENSORS].to_dict()],
        columns=SELECTED_SENSORS,
    )

    # Actual Random Forest prediction.
    prediction = float(
        rul_prediction.predict_rul(
            assets["rul_model"],
            features,
        )[0]
    )

    # Create/load SHAP TreeExplainer.
    explainer = load_shap_explainer()

    # Calculate SHAP values.
    shap_result = explainer.shap_values(features)

    shap_values = np.asarray(shap_result)

    # RandomForestRegressor normally returns:
    # (n_samples, n_features)
    if shap_values.ndim == 1:
        values = shap_values

    elif shap_values.ndim == 2:
        values = shap_values[0]

    else:
        values = np.squeeze(shap_values)

    values = np.asarray(values, dtype=float).flatten()

    # Base/reference value of the model.
    expected_value = np.asarray(
        explainer.expected_value
    ).flatten()

    base_value = float(expected_value[0])

    # Current feature values.
    current_values = features.iloc[0].astype(float)

    feature_explanations = []

    for sensor, shap_value in zip(
        SELECTED_SENSORS,
        values,
    ):
        feature_explanations.append(
            {
                "feature": sensor,
                "value": float(current_values[sensor]),
                "shap_value": float(shap_value),
                "absolute_shap": float(abs(shap_value)),
                "direction": (
                    "increases_prediction"
                    if shap_value > 0
                    else "decreases_prediction"
                    if shap_value < 0
                    else "neutral"
                ),
            }
        )

    # Highest absolute SHAP contributors first.
    feature_explanations.sort(
        key=lambda item: item["absolute_shap"],
        reverse=True,
    )

    positive_contributors = [
        item
        for item in feature_explanations
        if item["shap_value"] > 0
    ]

    negative_contributors = [
        item
        for item in feature_explanations
        if item["shap_value"] < 0
    ]

    # SHAP additive reconstruction.
    reconstructed_prediction = base_value + float(
        np.sum(values)
    )

    return json_safe(
        {
            "engine_id": int(engine_id),
            "cycle": int(row["cycle"]),

            "model": "RandomForestRegressor",

            "prediction": prediction,
            "predicted_rul": prediction,

            "base_value": base_value,

            "shap_sum": float(np.sum(values)),

            "reconstructed_prediction": reconstructed_prediction,

            "explanation_consistent": bool(
                np.isclose(
                    prediction,
                    reconstructed_prediction,
                    rtol=1e-3,
                    atol=1e-2,
                )
            ),

            "feature_count": len(feature_explanations),

            "features": feature_explanations,

            "positive_contributors": positive_contributors,

            "negative_contributors": negative_contributors,

            "top_features": feature_explanations[:10],

            "selected_sensors": SELECTED_SENSORS,

            "explanation_method": "SHAP TreeExplainer",

            "interpretation": (
                "Positive SHAP values push the predicted RUL upward "
                "relative to the model baseline. Negative SHAP values "
                "push the predicted RUL downward."
            ),
        }
    )

@app.get("/audio/samples", summary="List DGEN 380 audio samples")
def audio_samples():
    labels = audio_inference.load_json_if_exists(audio_inference.DGEN_LABELS_PATH)
    file_mapping = labels.get("file_mapping", {})
    samples = []
    for index, path in enumerate(audio_inference.discover_dgen_recordings()):
        known = file_mapping.get(path.name, {})
        samples.append({
            "id": index,
            "name": path.name,
            "size_mb": round(path.stat().st_size / (1024 * 1024), 3),
            "kind": "waveform" if path.stat().st_size > 100 * 1024 * 1024 else "metadata/performance",
            "known_label": known.get("condition"),
            "configuration": known.get("configuration"),
            "run_id": known.get("run_id"),
        })
    return {"samples": samples}


@app.get("/audio/sample/{sample_id}/metadata", summary="Return verified DGEN sample metadata")
def audio_metadata(sample_id: str):
    path = get_sample_path(sample_id)
    return metadata_response(path)


@app.post("/audio/analyze", summary="Analyze a selected DGEN recording")
def audio_analyze(request: AudioAnalyzeRequest):
    path = get_sample_path(request.sample_id)
    metadata = load_recording(path.name)
    if not metadata["microphone_channels"]:
        raise HTTPException(status_code=400, detail="Selected MAT file does not contain microphone waveforms")

    try:
        model, scaler = load_acoustic_assets()
        result = audio_inference.infer_acoustic_recording(
            path,
            preferred_channel=request.microphone_channel,
            model=model,
            scaler=scaler,
        )
        return result
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Acoustic analysis failed: {exc}") from exc


@app.get("/audio/sample/{sample_id}/waveform", summary="Return bounded waveform preview")
def audio_waveform(
    sample_id: str,
    channel: str = "mic1",
    max_points: int = Query(3000, ge=100, le=5000),
):
    path = get_sample_path(sample_id)
    metadata = load_recording(path.name)
    if channel not in metadata["loaded_data"].get("microphone_signals", {}):
        raise HTTPException(status_code=404, detail=f"Microphone channel {channel} not found")

    df = audio_inference.get_waveform_preview(metadata["loaded_data"], channel, max_points=max_points)
    return {
        "recording": path.name,
        "channel": channel,
        "time": [float(x) for x in df["Time (seconds)"].tolist()],
        "amplitude": [float(x) for x in df["Amplitude"].tolist()],
    }


@app.get("/audio/sample/{sample_id}/spectrogram", summary="Return bounded spectrogram data")
def audio_spectrogram(
    sample_id: str,
    channel: str = "mic1",
    max_duration_seconds: float = Query(5.0, gt=0, le=10.0),
    max_frequency_bins: int = Query(256, ge=32, le=512),
    max_time_bins: int = Query(160, ge=20, le=300),
):
    path = get_sample_path(sample_id)
    metadata = load_recording(path.name)
    if channel not in metadata["loaded_data"].get("microphone_signals", {}):
        raise HTTPException(status_code=404, detail=f"Microphone channel {channel} not found")

    spec = audio_inference.get_spectrogram_preview(
        metadata["loaded_data"],
        channel,
        max_duration_seconds=max_duration_seconds,
    )
    if spec["magnitude_db"] is None:
        raise HTTPException(status_code=400, detail="Spectrogram generation is unavailable")

    frequencies = np.asarray(spec["frequency"], dtype=float)
    times = np.asarray(spec["time"], dtype=float)
    magnitude = np.asarray(spec["magnitude_db"], dtype=float)

    f_step = max(1, int(np.ceil(len(frequencies) / max_frequency_bins)))
    t_step = max(1, int(np.ceil(len(times) / max_time_bins)))
    frequencies = frequencies[::f_step]
    times = times[::t_step]
    magnitude = magnitude[::f_step, ::t_step]

    return json_safe({
        "recording": path.name,
        "channel": channel,
        "time": times.tolist(),
        "frequency": frequencies.tolist(),
        "magnitude_db": magnitude.tolist(),
    })


@app.post("/fusion/analyze", summary="Return decision-level multimodal digital twin state")
def fusion_analyze(request: FusionAnalyzeRequest):
    sensor_state = create_sensor_state(request.engine_id, request.cycle)
    acoustic_state = audio_inference.no_audio_result()

    if request.audio_sample_id:
        path = get_sample_path(request.audio_sample_id)
        metadata = load_recording(path.name)
        if not metadata["microphone_channels"]:
            raise HTTPException(status_code=400, detail="Selected MAT file does not contain microphone waveforms")
        model, scaler = load_acoustic_assets()
        acoustic_state = audio_inference.infer_acoustic_recording(
            path,
            preferred_channel=request.microphone_channel,
            model=model,
            scaler=scaler,
        )

    return fusion.fuse_multimodal_state(sensor_state, acoustic_state)


@app.get("/models/metrics", summary="Return model metrics and limitations")
def model_metrics():
    acoustic_results = audio_inference.load_json_if_exists(audio_inference.ACOUSTIC_TRAINING_RESULTS_PATH)
    audio_config = audio_inference.load_json_if_exists(audio_inference.COMPAT_AUDIO_CONFIG_PATH)
    model_config = audio_inference.load_json_if_exists(MODEL_CONFIG_PATH)

    return json_safe({
        "cmapss": {
            "model": "RandomForestRegressor",
            "rul_cap": RUL_CAP,
            "official_test_mae": OFFICIAL_TEST_MAE,
            "official_test_rmse": OFFICIAL_TEST_RMSE,
            "selected_sensors": SELECTED_SENSORS,
            "source_config": model_config.get("rul_model", {}),
        },
        "sensor_anomaly": model_config.get("anomaly_detection", {}),
        "acoustic": {
            "model": acoustic_results.get("model_type", audio_config.get("model")),
            "evaluation_method": acoustic_results.get("cross_validation", {}).get("method"),
            "evaluation": acoustic_results.get("cross_validation", {}).get("evaluation"),
            "metrics": acoustic_results.get("cross_validation", {}).get("metrics"),
            "confusion_matrix": acoustic_results.get("confusion_matrix"),
            "feature_names": audio_inference.get_feature_columns(),
            "limitations": audio_config.get("limitations", []),
        },
        "fusion": {
            "method": "decision-level fusion",
            "raw_feature_fusion": False,
        },
    })
