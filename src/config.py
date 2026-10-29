"""Configuration settings for the Jet Engine Digital Twin system."""

from pathlib import Path

# Project directories
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
CMAPSS_DIR = DATA_DIR / "cmapss"
MODELS_DIR = PROJECT_ROOT / "models"
AUDIO_DIR = DATA_DIR / "audio"

# RUL Configuration
RUL_CAP = 125
RUL_CAPPING_THRESHOLD = 125

# Selected sensors (14 high-variance sensors)
SELECTED_SENSORS = [
    "sensor_2",
    "sensor_3",
    "sensor_4",
    "sensor_7",
    "sensor_8",
    "sensor_9",
    "sensor_11",
    "sensor_12",
    "sensor_13",
    "sensor_14",
    "sensor_15",
    "sensor_17",
    "sensor_20",
    "sensor_21"
]

# Health State Thresholds
HEALTH_THRESHOLDS = {
    "HEALTHY": 80,      # RUL > 80
    "MODERATE": 50,     # 50 < RUL <= 80
    "WARNING": 20,      # 20 < RUL <= 50
    "CRITICAL": 0       # RUL <= 20
}

# Anomaly Detection Configuration
# Anomaly threshold is calculated as 1st percentile of healthy training scores
# Final calibrated value: -0.0413953206
ANOMALY_THRESHOLD_PERCENTILE = 1  # 1st percentile of healthy training data
ANOMALY_THRESHOLD = -0.0413953206  # Calibrated threshold from 1st percentile

# Anomaly Severity Thresholds (based on percentiles of healthy training data)
ANOMALY_SEVERITY_THRESHOLDS = {
    "NORMAL": 0.06,          # Around median of healthy data
    "SUSPICIOUS": -0.006,    # Around 5th percentile
    "ANOMALOUS": -0.043      # Around 1st percentile
}

# Model file paths
RUL_MODEL_PATH = MODELS_DIR / "rul_random_forest.pkl"
ANOMALY_MODEL_PATH = MODELS_DIR / "anomaly_isolation_forest.pkl"
SELECTED_SENSORS_PATH = MODELS_DIR / "selected_sensors.pkl"
AUDIO_MODEL_PATH = MODELS_DIR / "audio_anomaly_model.pkl"
MODEL_CONFIG_PATH = MODELS_DIR / "model_config.json"

# CMAPSS Data Files
TRAIN_DATA_PATH = CMAPSS_DIR / "train_FD001.txt"
TEST_DATA_PATH = CMAPSS_DIR / "test_FD001.txt"
RUL_TRUTH_PATH = CMAPSS_DIR / "RUL_FD001.txt"

# Official Test Metrics (NASA FD001)
OFFICIAL_TEST_MAE = 11.7218
OFFICIAL_TEST_RMSE = 16.568921087385263

# Column names for CMAPSS data
CMAPSS_COLUMNS = [
    "engine_id", "cycle", 
    "setting_1", "setting_2", "setting_3",
    "sensor_1", "sensor_2", "sensor_3", "sensor_4", "sensor_5", "sensor_6",
    "sensor_7", "sensor_8", "sensor_9", "sensor_10", "sensor_11", "sensor_12",
    "sensor_13", "sensor_14", "sensor_15", "sensor_16", "sensor_17", "sensor_18",
    "sensor_19", "sensor_20", "sensor_21"
]

# Important sensors for dashboard visualization
IMPORTANT_SENSORS = [
    "sensor_11",
    "sensor_9",
    "sensor_4",
    "sensor_7",
    "sensor_12"
]

# Status categories
STATUS_CATEGORIES = ["HEALTHY", "MODERATE", "WARNING", "CRITICAL"]
ANOMALY_STATUS_CATEGORIES = ["NORMAL", "SUSPICIOUS", "ANOMALOUS"]
