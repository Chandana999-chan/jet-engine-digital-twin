"""Dataset-driven engine simulation and what-if scenario management."""

import time
from threading import RLock

import numpy as np
import pandas as pd
from fastapi import HTTPException

from src.config import (
    SELECTED_SENSORS,
    ANOMALY_THRESHOLD,
)
from src import (
    digital_twin,
    rul_prediction,
    anomaly_detection,
    preprocessing,
)

# One independent simulation session per engine.
_SIMULATIONS = {}
_LOCK = RLock()

DEFAULT_SPEED = 1.0
MIN_SPEED = 0.25
MAX_SPEED = 5.0


def _get_assets():
    """Reuse the models and test data already loaded by main.py."""
    from backend.main import load_sensor_assets
    return load_sensor_assets()


def _get_engine_rows(engine_id):
    assets = _get_assets()
    data = assets["test_data"]

    rows = data[data["engine_id"] == engine_id].copy()

    if rows.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Engine {engine_id} not found",
        )

    return rows.reset_index(drop=True)


def _get_session(engine_id):
    with _LOCK:
        if engine_id not in _SIMULATIONS:
            rows = _get_engine_rows(engine_id)

            _SIMULATIONS[engine_id] = {
                "engine_id": engine_id,
                "rows": rows,
                "index": 0,
                "playing": False,
                "speed": DEFAULT_SPEED,
                "last_update": time.monotonic(),
                "scenario": None,
                "shutdown": False,
            }

        return _SIMULATIONS[engine_id]


def _evaluate_features(engine_id, cycle, features, actual_rul=None):
    """Run the existing RUL and anomaly models on one feature row."""

    assets = _get_assets()

    feature_frame = pd.DataFrame(
        [[float(features[sensor]) for sensor in SELECTED_SENSORS]],
        columns=SELECTED_SENSORS,
    )

    predicted_rul = float(
        rul_prediction.predict_rul(
            assets["rul_model"],
            feature_frame,
        )[0]
    )

    anomaly_score = float(
        anomaly_detection.calculate_anomaly_score(
            assets["anomaly_model"],
            feature_frame,
        )[0]
    )

    anomaly_status = anomaly_detection.get_anomaly_status(
        anomaly_score,
        ANOMALY_THRESHOLD,
    )

    anomaly_severity = anomaly_detection.get_anomaly_severity(
        anomaly_score
    )

    state = digital_twin.create_digital_twin_state(
        engine_id=engine_id,
        current_cycle=cycle,
        predicted_rul=predicted_rul,
        anomaly_score=anomaly_score,
        anomaly_status=anomaly_status,
        anomaly_severity=anomaly_severity,
        actual_rul=actual_rul,
    )

    state["sensor_values"] = {
        sensor: float(features[sensor])
        for sensor in SELECTED_SENSORS
    }

    return state


def _advance_session(session):
    """Advance the dataset index according to elapsed time and speed."""

    if not session["playing"] or session["shutdown"]:
        return

    now = time.monotonic()
    elapsed = now - session["last_update"]

    # One dataset cycle per second at 1x speed.
    steps = int(elapsed * session["speed"])

    if steps <= 0:
        return

    session["index"] = min(
        session["index"] + steps,
        len(session["rows"]) - 1,
    )

    session["last_update"] = now

    if session["index"] >= len(session["rows"]) - 1:
        session["playing"] = False


def _build_response(session):
    """Build the complete simulation state."""

    _advance_session(session)

    row = session["rows"].iloc[session["index"]]

    features = {
        sensor: float(row[sensor])
        for sensor in SELECTED_SENSORS
    }

    baseline = _evaluate_features(
        session["engine_id"],
        int(row["cycle"]),
        features,
    )

    if session["scenario"]:
        result = session["scenario"]["state"]
    else:
        result = baseline

    return {
        **result,
        "engine_id": session["engine_id"],
        "cycle": int(row["cycle"]),
        "current_index": int(session["index"]),
        "total_cycles": len(session["rows"]),
        "first_cycle": int(session["rows"].iloc[0]["cycle"]),
        "last_cycle": int(session["rows"].iloc[-1]["cycle"]),
        "playing": bool(session["playing"]),
        "speed": float(session["speed"]),
        "simulation_mode": (
            "WHAT_IF_SCENARIO"
            if session["scenario"]
            else "DATASET_REPLAY"
        ),
        "scenario": (
            session["scenario"]["name"]
            if session["scenario"]
            else None
        ),
        "shutdown": bool(session["shutdown"]),
        "baseline": {
            "predicted_rul": baseline["predicted_rul"],
            "health_percentage": baseline["health_percentage"],
            "overall_status": baseline["overall_status"],
            "anomaly_score": baseline["sensor_anomaly_score"],
        },
    }


def get_info(engine_id):
    rows = _get_engine_rows(engine_id)

    return {
        "engine_id": engine_id,
        "total_cycles": len(rows),
        "first_cycle": int(rows.iloc[0]["cycle"]),
        "last_cycle": int(rows.iloc[-1]["cycle"]),
        "selected_sensors": SELECTED_SENSORS,
        "mode": "C-MAPSS FD001 dataset replay",
    }


def get_state(engine_id):
    session = _get_session(engine_id)

    with _LOCK:
        return _build_response(session)


def start(engine_id, speed=None):
    session = _get_session(engine_id)

    with _LOCK:
        if speed is not None:
            session["speed"] = float(
                np.clip(speed, MIN_SPEED, MAX_SPEED)
            )

        if session["index"] >= len(session["rows"]) - 1:
            session["index"] = 0

        session["playing"] = True
        session["shutdown"] = False
        session["last_update"] = time.monotonic()

        return _build_response(session)


def pause(engine_id):
    session = _get_session(engine_id)

    with _LOCK:
        _advance_session(session)
        session["playing"] = False

        return _build_response(session)


def resume(engine_id):
    session = _get_session(engine_id)

    with _LOCK:
        if not session["shutdown"]:
            session["playing"] = True
            session["last_update"] = time.monotonic()

        return _build_response(session)


def reset(engine_id):
    session = _get_session(engine_id)

    with _LOCK:
        session["index"] = 0
        session["playing"] = False
        session["scenario"] = None
        session["shutdown"] = False
        session["last_update"] = time.monotonic()

        return _build_response(session)


def set_cycle(engine_id, cycle):
    session = _get_session(engine_id)

    with _LOCK:
        matched = session["rows"].index[
            session["rows"]["cycle"] == cycle
        ]

        if len(matched) == 0:
            raise HTTPException(
                status_code=404,
                detail=f"Cycle {cycle} not found",
            )

        session["index"] = int(matched[0])
        session["playing"] = False
        session["last_update"] = time.monotonic()

        return _build_response(session)


def set_speed(engine_id, speed):
    if not MIN_SPEED <= speed <= MAX_SPEED:
        raise HTTPException(
            status_code=400,
            detail=f"Speed must be between {MIN_SPEED} and {MAX_SPEED}",
        )

    session = _get_session(engine_id)

    with _LOCK:
        _advance_session(session)
        session["speed"] = float(speed)
        session["last_update"] = time.monotonic()

        return _build_response(session)


def apply_scenario(engine_id, name, overrides, shutdown=False):
    session = _get_session(engine_id)

    with _LOCK:
        row = session["rows"].iloc[session["index"]]

        features = {
            sensor: float(row[sensor])
            for sensor in SELECTED_SENSORS
        }

        if not shutdown and not overrides:
            raise HTTPException(
                status_code=400,
                detail="Provide at least one sensor override",
            )

        for sensor, value in overrides.items():
            if sensor not in SELECTED_SENSORS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported sensor: {sensor}",
                )

            value = float(value)

            if not np.isfinite(value):
                raise HTTPException(
                    status_code=400,
                    detail="Sensor values must be finite numbers",
                )

            features[sensor] = value

        state = _evaluate_features(
            engine_id,
            int(row["cycle"]),
            features,
        )

        # Shutdown is a visual/control state. The ML models do not
        # independently predict that an actual engine has shut down.
        session["scenario"] = {
            "name": name,
            "state": state,
            "overrides": overrides,
        }

        session["shutdown"] = bool(shutdown)

        if shutdown:
            session["playing"] = False

        return _build_response(session)


def clear_scenario(engine_id):
    session = _get_session(engine_id)

    with _LOCK:
        session["scenario"] = None
        session["shutdown"] = False

        return _build_response(session)