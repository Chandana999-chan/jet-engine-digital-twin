"""Acoustic inference utilities for DGEN 380 diagnostic recordings.

The DGEN 380 acoustic data is independent from NASA C-MAPSS. This module keeps
audio discovery, MAT loading, feature extraction, and saved classifier inference
outside the Streamlit dashboard so UI code does not duplicate ML logic.
"""

from pathlib import Path
import json
from typing import Dict, List, Optional

import joblib
import numpy as np
import pandas as pd

from . import audio_processing
from .config import AUDIO_DIR, PROJECT_ROOT


DGEN_DIR = AUDIO_DIR / "dgen380"
DGEN_LABELS_PATH = AUDIO_DIR / "dgen380_labels.json"
DGEN_FEATURE_METADATA_PATH = AUDIO_DIR / "dgen380_features_metadata.json"
ACOUSTIC_MODEL_PATH = PROJECT_ROOT / "models" / "acoustic" / "acoustic_classifier.pkl"
ACOUSTIC_SCALER_PATH = PROJECT_ROOT / "models" / "acoustic" / "scaler.pkl"
ACOUSTIC_TRAINING_RESULTS_PATH = PROJECT_ROOT / "models" / "acoustic" / "training_results.json"
COMPAT_AUDIO_MODEL_PATH = PROJECT_ROOT / "models" / "audio_anomaly_model.pkl"
COMPAT_AUDIO_SCALER_PATH = PROJECT_ROOT / "models" / "audio_scaler.pkl"
COMPAT_AUDIO_FEATURE_NAMES_PATH = PROJECT_ROOT / "models" / "audio_feature_names.pkl"
COMPAT_AUDIO_CONFIG_PATH = PROJECT_ROOT / "models" / "audio_config.json"
AUDIO_STATUS_THRESHOLDS = {
    "normal_max": 0.33,
    "suspicious_max": 0.67,
}


def discover_dgen_recordings(audio_dir: Path = DGEN_DIR) -> List[Path]:
    """Return available DGEN 380 MAT recordings."""
    audio_dir = Path(audio_dir)
    if not audio_dir.exists():
        return []
    return sorted(audio_dir.glob("*.mat"))


def discover_labeled_waveform_recordings(audio_dir: Path = DGEN_DIR) -> List[Path]:
    """Return DGEN waveform recordings with verified labels."""
    labels = load_json_if_exists(DGEN_LABELS_PATH)
    mapped = labels.get("file_mapping", {})
    return [Path(audio_dir) / name for name in sorted(mapped) if (Path(audio_dir) / name).exists()]


def load_json_if_exists(path: Path) -> Dict:
    """Load JSON from disk, returning an empty dict if the file is absent."""
    path = Path(path)
    if not path.exists():
        return {}
    with open(path, "r") as f:
        return json.load(f)


def get_known_recording_label(recording_path: Path, labels: Optional[Dict] = None) -> Dict:
    """Return known dataset metadata for a recording, if present in labels JSON."""
    labels = labels if labels is not None else load_json_if_exists(DGEN_LABELS_PATH)
    file_mapping = labels.get("file_mapping", {})
    return file_mapping.get(Path(recording_path).name, {})


def get_feature_columns(metadata: Optional[Dict] = None) -> List[str]:
    """Return acoustic model feature columns in training order."""
    metadata = metadata if metadata is not None else load_json_if_exists(DGEN_FEATURE_METADATA_PATH)
    metadata_columns = set(metadata.get("metadata_columns", []))
    columns = metadata.get("columns", [])
    feature_columns = [col for col in columns if col not in metadata_columns]
    if feature_columns:
        return feature_columns

    feature_csv = AUDIO_DIR / "dgen380_features.csv"
    if feature_csv.exists():
        df = pd.read_csv(feature_csv, nrows=1)
        fallback_metadata = {
            "file_id",
            "run_id",
            "condition",
            "label",
            "configuration",
            "channel",
            "channel_idx",
            "window_idx",
        }
        return [col for col in df.columns if col not in fallback_metadata]

    return []


def load_acoustic_assets(
    model_path: Path = ACOUSTIC_MODEL_PATH,
    scaler_path: Path = ACOUSTIC_SCALER_PATH,
):
    """Load the saved DGEN 380 acoustic classifier and scaler."""

    model_path = Path(model_path)
    scaler_path = Path(scaler_path)

    if not model_path.exists():
        raise FileNotFoundError(
            f"Acoustic classifier not found: {model_path}"
        )

    if not scaler_path.exists():
        raise FileNotFoundError(
            f"Acoustic scaler not found: {scaler_path}"
        )

    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)

    return model, scaler

def load_recording_metadata(recording_path: Path) -> Dict:
    """Load a DGEN recording and return available verified metadata."""
    data = audio_processing.load_dgen_mat(str(recording_path))
    channel_names = sorted(data["microphone_signals"].keys())
    labels = load_json_if_exists(DGEN_LABELS_PATH)
    known_label = get_known_recording_label(recording_path, labels)

    return {
        "filename": Path(recording_path).name,
        "known_label": known_label.get("condition"),
        "configuration": known_label.get("configuration"),
        "run_id": known_label.get("run_id"),
        "sampling_rate": float(data["sampling_rate"]),
        "duration": float(data["duration"]) if data["duration"] is not None else None,
        "num_samples": int(data["num_samples"]) if data["num_samples"] is not None else None,
        "microphone_channels": channel_names,
        "loaded_data": data,
    }


def choose_microphone_channel(recording_data: Dict, preferred_channel: str = "mic1") -> str:
    """Choose a microphone channel that is available in the recording."""
    microphone_signals = recording_data.get("microphone_signals", {})
    if preferred_channel in microphone_signals:
        return preferred_channel
    if microphone_signals:
        return sorted(microphone_signals.keys())[0]
    raise ValueError("No microphone channels found in recording")


def build_feature_frame_for_channel(
    recording_path: Path,
    channel: str,
    feature_columns: List[str],
) -> pd.DataFrame:
    """Extract model-ready acoustic features for one microphone channel."""
    df = audio_processing.extract_features_from_file(
        str(recording_path),
        microphone_channels=[channel],
    )
    if df.empty:
        raise ValueError(f"No acoustic windows extracted from {Path(recording_path).name}")

    missing_columns = [col for col in feature_columns if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing acoustic feature columns: {missing_columns}")

    feature_frame = df[feature_columns].replace([np.inf, -np.inf], np.nan).fillna(0.0)
    return feature_frame


def build_feature_frame_from_recording_data(
    recording_data: Dict,
    source_filename: str,
    channel: str,
    feature_columns: List[str],
) -> pd.DataFrame:
    """Extract model-ready acoustic features from already loaded MAT data."""
    microphone_signals = recording_data.get("microphone_signals", {})
    if channel not in microphone_signals:
        raise ValueError(f"Microphone channel {channel} not found in {source_filename}")

    signal = audio_processing.preprocess_signal(microphone_signals[channel])
    windows = audio_processing.segment_signal(signal, float(recording_data["sampling_rate"]))
    if not windows:
        raise ValueError(f"No acoustic windows extracted from {source_filename}")

    rows = []
    for window_idx, window in enumerate(windows):
        features = audio_processing.extract_audio_features(window, float(recording_data["sampling_rate"]))
        features["source_file"] = source_filename
        features["channel"] = channel
        features["window_idx"] = window_idx
        rows.append(features)

    df = pd.DataFrame(rows)
    missing_columns = [col for col in feature_columns if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing acoustic feature columns: {missing_columns}")

    return df[feature_columns].replace([np.inf, -np.inf], np.nan).fillna(0.0)


def infer_acoustic_recording(
    recording_path: Path,
    preferred_channel: str = "mic1",
    model=None,
    scaler=None,
) -> Dict:
    """Run the saved acoustic classifier on one DGEN 380 recording."""
    recording_path = Path(recording_path)
    metadata = load_recording_metadata(recording_path)
    channel = choose_microphone_channel(metadata["loaded_data"], preferred_channel)
    feature_columns = get_feature_columns()
    if not feature_columns:
        raise ValueError("Acoustic feature column metadata is unavailable")

    if model is None or scaler is None:
        model, scaler = load_acoustic_assets()

    feature_frame = build_feature_frame_from_recording_data(
        metadata["loaded_data"],
        metadata["filename"],
        channel,
        feature_columns,
    )
    scaled_features = scaler.transform(feature_frame.values)
    predictions = model.predict(scaled_features)

    probability_faulty = None
    probability_normal = None
    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(scaled_features)
        class_list = list(model.classes_)
        if 1 in class_list:
            faulty_idx = class_list.index(1)
            probability_faulty = float(np.mean(probabilities[:, faulty_idx]))
        if 0 in class_list:
            normal_idx = class_list.index(0)
            probability_normal = float(np.mean(probabilities[:, normal_idx]))

    abnormal_votes = int(np.sum(predictions == 1))
    normal_votes = int(np.sum(predictions == 0))
    acoustic_condition = classify_audio_status(probability_faulty, abnormal_votes, normal_votes)

    result = {
        "filename": metadata["filename"],
        "recording": metadata["filename"],
        "known_label": metadata["known_label"],
        "label": metadata["known_label"],
        "configuration": metadata["configuration"],
        "run_id": metadata["run_id"],
        "microphone_channel": channel,
        "sampling_rate": metadata["sampling_rate"],
        "sample_rate": metadata["sampling_rate"],
        "duration": metadata["duration"],
        "duration_seconds": metadata["duration"],
        "num_samples": metadata["num_samples"],
        "num_windows": int(len(feature_frame)),
        "acoustic_condition": acoustic_condition,
        "audio_status": acoustic_condition,
        "model_score_probability": probability_faulty,
        "model_probability": probability_faulty,
        "fault_score": probability_faulty,
        "probability_normal": probability_normal,
        "window_votes": {
            "normal": normal_votes,
            "abnormal": abnormal_votes,
        },
        "model": "DGEN 380 Acoustic RandomForestClassifier",
        "probability_label": "Model score/probability",
        "caveat": (
            "Normal and faulty recordings in the available DGEN subset may differ "
            "in engine/configuration conditions as well as fault state."
        ),
    }

    return make_json_serializable(result)


def classify_audio_status(
    model_probability: Optional[float],
    abnormal_votes: int = 0,
    normal_votes: int = 0,
    thresholds: Optional[Dict[str, float]] = None,
) -> str:
    """Map model score/probability into NORMAL, SUSPICIOUS, or ABNORMAL."""
    thresholds = thresholds or AUDIO_STATUS_THRESHOLDS
    if model_probability is None:
        return "ABNORMAL" if abnormal_votes > normal_votes else "NORMAL"
    if model_probability < thresholds["normal_max"]:
        return "NORMAL"
    if model_probability < thresholds["suspicious_max"]:
        return "SUSPICIOUS"
    return "ABNORMAL"


def analyze_dgen_recording(path: Path, preferred_channel: str = "mic1") -> Dict:
    """High-level API for DGEN acoustic analysis."""
    return infer_acoustic_recording(Path(path), preferred_channel=preferred_channel)


def analyze_audio_file(path: Path, preferred_channel: str = "mic1") -> Dict:
    """Compatibility alias for API callers."""
    path = Path(path)
    if path.suffix.lower() != ".mat":
        raise ValueError("Only DGEN 380 .mat recordings are supported by this backend")
    return analyze_dgen_recording(path, preferred_channel=preferred_channel)


def get_waveform_preview(
    recording_data: Dict,
    channel: str,
    max_points: int = 5000,
) -> pd.DataFrame:
    """Return a downsampled waveform preview for visualization only."""
    sampling_rate = float(recording_data["sampling_rate"])
    signal = audio_processing.preprocess_signal(recording_data["microphone_signals"][channel])
    step = max(1, int(np.ceil(len(signal) / max_points)))
    preview = signal[::step]
    time_axis = np.arange(0, len(signal), step, dtype=np.float64)[: len(preview)] / sampling_rate
    return pd.DataFrame({"Time (seconds)": time_axis, "Amplitude": preview})


def get_spectrogram_preview(
    recording_data: Dict,
    channel: str,
    max_duration_seconds: float = 5.0,
) -> Dict:
    """Return a compact dB spectrogram for a representative signal segment."""
    sampling_rate = float(recording_data["sampling_rate"])
    signal = audio_processing.preprocess_signal(recording_data["microphone_signals"][channel])
    segment_samples = min(len(signal), int(max_duration_seconds * sampling_rate))
    segment = signal[:segment_samples]
    freqs, times, spec_db = audio_processing.compute_spectrogram(segment, sampling_rate)
    return {
        "frequencies": freqs,
        "frequency": freqs,
        "times": times,
        "time": times,
        "spectrogram_db": spec_db,
        "magnitude_db": spec_db,
    }


def no_audio_result() -> Dict:
    """Return a JSON-safe result for sensor-only operation."""
    return {
        "acoustic_condition": "Not evaluated",
        "model_score_probability": None,
        "probability_label": "Model score/probability",
        "num_windows": 0,
        "microphone_channel": None,
    }


def make_json_serializable(value):
    """Convert NumPy/Pandas values into JSON-serializable Python values."""
    if isinstance(value, dict):
        return {str(k): make_json_serializable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [make_json_serializable(v) for v in value]
    if isinstance(value, tuple):
        return tuple(make_json_serializable(v) for v in value)
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        number = float(value)
        return number if np.isfinite(number) else None
    if isinstance(value, float):
        return value if np.isfinite(value) else None
    if isinstance(value, int):
        return value
    if isinstance(value, np.ndarray):
        return value.tolist()
    return value
