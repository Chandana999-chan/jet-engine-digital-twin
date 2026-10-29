"""Decision-level fusion for C-MAPSS sensor state and DGEN acoustic state."""

from datetime import datetime

from .digital_twin import get_maintenance_recommendation
from .audio_inference import make_json_serializable


STATUS_ORDER = ["HEALTHY", "MODERATE", "WARNING", "CRITICAL"]


def _status_index(status):
    if status in STATUS_ORDER:
        return STATUS_ORDER.index(status)
    return 0


def _increase_status(status, steps=1):
    index = min(_status_index(status) + steps, len(STATUS_ORDER) - 1)
    return STATUS_ORDER[index]


def fuse_multimodal_state(sensor_state, acoustic_state=None):
    """Fuse model outputs only, never raw C-MAPSS and DGEN feature vectors."""
    acoustic_state = acoustic_state or {
        "audio_status": "Not evaluated",
        "model_probability": None,
        "recording": None,
    }

    sensor_status = sensor_state.get("overall_status", sensor_state.get("health_state", "HEALTHY"))
    audio_status = acoustic_state.get(
        "audio_status",
        acoustic_state.get("acoustic_condition", "Not evaluated"),
    )

    if sensor_status == "CRITICAL":
        fused_status = "CRITICAL"
        fusion_reason = "Sensor digital twin is critical; acoustic input cannot downgrade it."
    elif audio_status == "Not evaluated":
        fused_status = sensor_status
        fusion_reason = "Sensor-only mode; no DGEN acoustic diagnostic selected."
    elif audio_status == "NORMAL":
        fused_status = sensor_status
        fusion_reason = "Acoustic diagnostic is normal, so sensor condition is preserved."
    elif audio_status == "SUSPICIOUS":
        fused_status = _increase_status(sensor_status, 1)
        fusion_reason = "Suspicious acoustic diagnostic increases severity by one level."
    elif audio_status == "ABNORMAL":
        steps = 2 if sensor_status == "WARNING" else 1
        fused_status = _increase_status(sensor_status, steps)
        fusion_reason = "Abnormal acoustic diagnostic escalates the decision-level status conservatively."
    else:
        fused_status = sensor_status
        fusion_reason = "Unknown acoustic status; sensor condition is preserved."

    output = {
        "engine_id": sensor_state.get("engine_id"),
        "current_cycle": sensor_state.get("current_cycle"),
        "cycle": sensor_state.get("current_cycle"),
        "predicted_rul": sensor_state.get("predicted_rul"),
        "health_percentage": sensor_state.get("health_percentage"),
        "health_state": sensor_state.get("health_state"),
        "sensor_anomaly_status": sensor_state.get("sensor_anomaly_status"),
        "sensor_anomaly_score": sensor_state.get("sensor_anomaly_score"),
        "sensor_anomaly": {
            "status": sensor_state.get("sensor_anomaly_status"),
            "severity": sensor_state.get("sensor_anomaly_severity"),
            "score": sensor_state.get("sensor_anomaly_score"),
        },
        "acoustic": {
            "recording": acoustic_state.get("recording", acoustic_state.get("filename")),
            "status": audio_status,
            "model_probability": acoustic_state.get(
                "model_probability",
                acoustic_state.get("model_score_probability"),
            ),
            "microphone_channel": acoustic_state.get("microphone_channel"),
            "num_windows": acoustic_state.get("num_windows"),
            "label": acoustic_state.get("label", acoustic_state.get("known_label")),
        },
        "overall_status": fused_status,
        "maintenance_recommendation": get_maintenance_recommendation(fused_status),
        "fusion": {
            "level": "decision",
            "reason": fusion_reason,
            "timestamp": datetime.now().isoformat(),
            "datasets_independent": True,
        },
        "limitations": [
            "C-MAPSS and DGEN 380 are independent datasets.",
            "DGEN recordings are not synchronized with selected C-MAPSS engines.",
            "Acoustic classification is condition-monitoring, not acoustic RUL prediction.",
        ],
    }
    return make_json_serializable(output)
