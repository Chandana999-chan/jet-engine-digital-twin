"""RUL prediction utilities."""

import numpy as np
try:
    from sklearn.externals import joblib
except ImportError:
    import joblib

from .config import (
    RUL_MODEL_PATH, RUL_CAP, HEALTH_THRESHOLDS,
    SELECTED_SENSORS
)


def load_rul_model(model_path=None):
    """Load the trained RUL model."""
    if model_path is None:
        model_path = RUL_MODEL_PATH
    
    return joblib.load(model_path)


def predict_rul(model, features_df):
    """Predict RUL for given sensor features.
    
    Parameters:
    -----------
    model : sklearn model
        Trained RUL prediction model
    features_df : pd.DataFrame or np.ndarray
        Features for prediction (sensor columns only)
    
    Returns:
    --------
    np.ndarray of predicted RUL values (capped at RUL_CAP)
    """
    predictions = model.predict(features_df)
    # Ensure predictions are within bounds
    predictions = np.clip(predictions, 0, RUL_CAP)
    return predictions


def get_health_percentage(predicted_rul):
    """Calculate health percentage from predicted RUL.
    
    health_percentage = (predicted_rul / RUL_CAP) * 100
    Clamped between 0 and 100.
    """
    health_pct = (predicted_rul / RUL_CAP) * 100
    return np.clip(health_pct, 0, 100)


def get_health_state(predicted_rul):
    """Get health state category based on predicted RUL.
    
    Returns one of: HEALTHY, MODERATE, WARNING, CRITICAL
    """
    if predicted_rul > HEALTH_THRESHOLDS["HEALTHY"]:
        return "HEALTHY"
    elif predicted_rul > HEALTH_THRESHOLDS["MODERATE"]:
        return "MODERATE"
    elif predicted_rul > HEALTH_THRESHOLDS["WARNING"]:
        return "WARNING"
    else:
        return "CRITICAL"


def get_health_state_batch(predicted_ruls):
    """Get health state for multiple RUL predictions.
    
    Parameters:
    -----------
    predicted_ruls : np.ndarray or list
        Predicted RUL values
    
    Returns:
    --------
    list of health state strings
    """
    return [get_health_state(rul) for rul in predicted_ruls]
