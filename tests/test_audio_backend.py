"""FastAPI backend tests for Member 3 audio/vibration integration."""

import json
import sys
from pathlib import Path


project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from fastapi.testclient import TestClient  # noqa: E402

from backend.main import app  # noqa: E402


client = TestClient(app)


def assert_ok(response):
    assert response.status_code == 200, f"{response.status_code}: {response.text}"
    return response.json()


def test_health():
    data = assert_ok(client.get("/health"))
    assert data["status"] == "ok"


def test_engines():
    data = assert_ok(client.get("/engines"))
    assert len(data["engines"]) == 100
    assert 1 in data["engines"]


def test_engine_state():
    data = assert_ok(client.get("/engine/41/state?cycle=123"))
    assert data["engine_id"] == 41
    assert data["cycle"] == 123
    assert 0 <= data["health_percentage"] <= 100
    assert data["sensor_anomaly"]["score"] is not None
    json.dumps(data)


def test_engine_history_and_sensors():
    history = assert_ok(client.get("/engine/41/history"))
    assert history["engine_id"] == 41
    assert len(history["history"]) > 0

    sensors = assert_ok(client.get("/engine/41/sensors?sensors=sensor_11,sensor_9,sensor_4"))
    assert sensors["sensors"] == ["sensor_11", "sensor_9", "sensor_4"]
    assert len(sensors["history"]) > 0


def test_invalid_engine_returns_404():
    response = client.get("/engine/9999/state")
    assert response.status_code == 404


def test_audio_samples_and_metadata():
    samples = assert_ok(client.get("/audio/samples"))
    assert len(samples["samples"]) >= 4

    waveform_samples = [sample for sample in samples["samples"] if sample["kind"] == "waveform"]
    assert waveform_samples, "No DGEN waveform samples listed"

    metadata = assert_ok(client.get(f"/audio/sample/{waveform_samples[0]['name']}/metadata"))
    assert metadata["sample_rate"] > 0
    assert metadata["microphone_channels"]


def test_audio_analyze_and_visualization():
    sample_name = "Desir_II_configuration_2_normal_1.mat"
    analyzed = assert_ok(client.post("/audio/analyze", json={"sample_id": sample_name}))
    assert analyzed["audio_status"] in ["NORMAL", "SUSPICIOUS", "ABNORMAL"]
    assert analyzed["num_windows"] > 0
    if analyzed["model_probability"] is not None:
        assert 0 <= analyzed["model_probability"] <= 1

    waveform = assert_ok(client.get(f"/audio/sample/{sample_name}/waveform?max_points=1000"))
    assert len(waveform["time"]) <= 1000
    assert len(waveform["time"]) == len(waveform["amplitude"])

    spectrogram = assert_ok(client.get(f"/audio/sample/{sample_name}/spectrogram?max_frequency_bins=96&max_time_bins=80"))
    assert len(spectrogram["frequency"]) <= 96
    assert len(spectrogram["time"]) <= 80
    assert len(spectrogram["magnitude_db"]) == len(spectrogram["frequency"])


def test_fusion_and_metrics():
    sample_name = "Desir_II_configuration_2_normal_1.mat"
    fused = assert_ok(client.post(
        "/fusion/analyze",
        json={"engine_id": 41, "cycle": 123, "audio_sample_id": sample_name},
    ))
    assert fused["engine_id"] == 41
    assert fused["fusion"]["level"] == "decision"
    assert fused["overall_status"] in ["HEALTHY", "MODERATE", "WARNING", "CRITICAL"]
    json.dumps(fused)

    sensor_only = assert_ok(client.post("/fusion/analyze", json={"engine_id": 41, "cycle": 123}))
    assert sensor_only["acoustic"]["status"] == "Not evaluated"
    json.dumps(sensor_only)

    metrics = assert_ok(client.get("/models/metrics"))
    assert metrics["cmapss"]["official_test_mae"] == 11.7218
    assert metrics["cmapss"]["official_test_rmse"] == 16.568921087385263
    assert metrics["fusion"]["method"] == "decision-level fusion"
    json.dumps(metrics)


def main():
    tests = [
        test_health,
        test_engines,
        test_engine_state,
        test_engine_history_and_sensors,
        test_invalid_engine_returns_404,
        test_audio_samples_and_metadata,
        test_audio_analyze_and_visualization,
        test_fusion_and_metrics,
    ]

    for test in tests:
        test()
        print(f"[OK] {test.__name__}")

    print("[OK] API TestClient tests passed")


if __name__ == "__main__":
    main()
