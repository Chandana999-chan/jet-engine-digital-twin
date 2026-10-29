"""Data loading and preprocessing utilities."""

import pandas as pd
import numpy as np
from pathlib import Path
try:
    from sklearn.externals import joblib
except ImportError:
    import joblib

from .config import (
    CMAPSS_COLUMNS, TRAIN_DATA_PATH, TEST_DATA_PATH, RUL_TRUTH_PATH,
    SELECTED_SENSORS, RUL_CAP, SELECTED_SENSORS_PATH
)


def load_cmapss(filepath):
    """Load CMAPSS data from text file."""
    data = pd.read_csv(filepath, sep=r"\s+", header=None)
    data.columns = CMAPSS_COLUMNS
    return data


def load_train_data():
    """Load training data."""
    return load_cmapss(TRAIN_DATA_PATH)


def load_test_data():
    """Load official test data."""
    return load_cmapss(TEST_DATA_PATH)


def load_rul_truth():
    """Load ground truth RUL values for test set."""
    rul_data = pd.read_csv(RUL_TRUTH_PATH, header=None, names=["RUL"])
    return rul_data["RUL"].values


def create_rul(data):
    """Create RUL target for training data.
    
    RUL = maximum cycle for engine - current cycle
    Then cap at RUL_CAP = 125
    """
    data = data.copy()
    max_cycles = data.groupby("engine_id")["cycle"].max()
    data["RUL"] = data.groupby("engine_id")["cycle"].transform(
        lambda x: max_cycles.loc[x.name] - x
    )
    data["RUL_capped"] = data["RUL"].clip(upper=RUL_CAP)
    return data


def select_features(data, sensor_list=None):
    """Select only the specified sensor features.
    
    Parameters:
    -----------
    data : pd.DataFrame
        Full CMAPSS data with all 21 sensors
    sensor_list : list, optional
        List of sensor columns to keep. Defaults to SELECTED_SENSORS.
    
    Returns:
    --------
    pd.DataFrame with only selected sensors plus engine_id and cycle
    """
    if sensor_list is None:
        sensor_list = SELECTED_SENSORS
    
    cols_to_keep = ["engine_id", "cycle"] + sensor_list
    return data[cols_to_keep]


def get_last_engine_cycle(data):
    """Get the last cycle data for each engine.
    
    Parameters:
    -----------
    data : pd.DataFrame
        Engine data with multiple cycles per engine
    
    Returns:
    --------
    pd.DataFrame with one row per engine (the last cycle)
    """
    return data.groupby("engine_id").tail(1)


def create_rolling_means(data, sensors, window=5):
    """Create rolling mean features for specified sensors.
    
    Parameters:
    -----------
    data : pd.DataFrame
        Data with sensor columns
    sensors : list
        List of sensor column names
    window : int
        Rolling window size
    
    Returns:
    --------
    pd.DataFrame with original data + rolling mean columns
    """
    data = data.copy()
    for sensor in sensors:
        col_name = f"{sensor}_roll{window}"
        data[col_name] = (
            data.groupby("engine_id")[sensor]
            .transform(lambda x: x.rolling(window, min_periods=1).mean())
        )
    return data


def save_selected_sensors(sensors, output_path=None):
    """Save selected sensors list for reproducibility."""
    if output_path is None:
        output_path = SELECTED_SENSORS_PATH
    
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(sensors, output_path)


def load_selected_sensors(input_path=None):
    """Load selected sensors list."""
    if input_path is None:
        input_path = SELECTED_SENSORS_PATH
    
    return joblib.load(input_path)


def get_sensor_columns_only(data):
    """Get only sensor columns from data."""
    sensor_cols = [col for col in data.columns if col.startswith("sensor_")]
    return data[sensor_cols]
