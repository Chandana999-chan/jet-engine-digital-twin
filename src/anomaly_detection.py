"""Anomaly detection utilities."""

import numpy as np
try:
    from sklearn.externals import joblib
except ImportError:
    import joblib

from .config import (
    ANOMALY_MODEL_PATH, ANOMALY_THRESHOLD, ANOMALY_SEVERITY_THRESHOLDS
)


def load_anomaly_model(model_path=None):
    """Load the trained anomaly detection model."""
    if model_path is None:
        model_path = ANOMALY_MODEL_PATH
    
    return joblib.load(model_path)


def calculate_anomaly_score(model, features_df):
    """Calculate raw anomaly score using decision_function.
    
    Parameters:
    -----------
    model : IsolationForest
        Trained anomaly detection model
    features_df : pd.DataFrame or np.ndarray
        Features for anomaly scoring (sensor columns only)
    
    Returns:
    --------
    np.ndarray of anomaly scores
        Lower score = more anomalous
        Higher score = more normal
    """
    return model.decision_function(features_df)


def get_anomaly_status(score, threshold=ANOMALY_THRESHOLD):
    """Determine anomaly status from score using calibrated threshold.
    
    Parameters:
    -----------
    score : float
        Anomaly score from decision_function
    threshold : float
        Decision threshold (default from config)
    
    Returns:
    --------
    str: "NORMAL" if score >= threshold, "ANOMALOUS" otherwise
    """
    if score >= threshold:
        return "NORMAL"
    else:
        return "ANOMALOUS"


def get_anomaly_severity(score):
    """Determine anomaly severity level.
    
    Severity levels based on percentiles of healthy training data:
    - NORMAL: score above reasonable threshold (median area)
    - SUSPICIOUS: score in intermediate range
    - ANOMALOUS: score in low range (1st percentile area)
    
    Parameters:
    -----------
    score : float
        Anomaly score from decision_function
    
    Returns:
    --------
    str: One of "NORMAL", "SUSPICIOUS", "ANOMALOUS"
    """
    # Thresholds from config
    normal_threshold = ANOMALY_SEVERITY_THRESHOLDS["NORMAL"]
    suspicious_threshold = ANOMALY_SEVERITY_THRESHOLDS["SUSPICIOUS"]
    # anomalous_threshold = ANOMALY_SEVERITY_THRESHOLDS["ANOMALOUS"]
    
    if score >= normal_threshold:
        return "NORMAL"
    elif score >= suspicious_threshold:
        return "SUSPICIOUS"
    else:
        return "ANOMALOUS"


def get_anomaly_status_batch(model, features_df, threshold=ANOMALY_THRESHOLD):
    """Get anomaly status for multiple feature sets.
    
    Parameters:
    -----------
    model : IsolationForest
        Trained anomaly detection model
    features_df : pd.DataFrame or np.ndarray
        Multiple feature sets for anomaly scoring
    threshold : float
        Decision threshold
    
    Returns:
    --------
    tuple of (scores, statuses)
        scores : np.ndarray of anomaly scores
        statuses : list of anomaly status strings
    """
    scores = calculate_anomaly_score(model, features_df)
    statuses = [get_anomaly_status(score, threshold) for score in scores]
    return scores, statuses


def get_anomaly_severity_batch(scores):
    """Get anomaly severity for multiple scores.
    
    Parameters:
    -----------
    scores : np.ndarray or list
        Anomaly scores
    
    Returns:
    --------
    list of severity strings
    """
    return [get_anomaly_severity(score) for score in scores]


def calculate_threshold_percentile(model, healthy_features, percentile=1):
    """Calculate anomaly threshold from healthy training data.
    
    Parameters:
    -----------
    model : IsolationForest
        Trained anomaly detection model
    healthy_features : pd.DataFrame or np.ndarray
        Features from healthy engines (RUL_capped == 125)
    percentile : float
        Percentile to use as threshold (default 1st percentile)
    
    Returns:
    --------
    float : threshold value
    """
    scores = calculate_anomaly_score(model, healthy_features)
    threshold = np.percentile(scores, percentile)
    return threshold
