"""Digital Twin state creation and management."""

import numpy as np
from .config import STATUS_CATEGORIES
from .rul_prediction import get_health_percentage, get_health_state
from .anomaly_detection import get_anomaly_status, get_anomaly_severity


def create_digital_twin_state(
    engine_id,
    current_cycle,
    predicted_rul,
    anomaly_score=None,
    anomaly_status=None,
    anomaly_severity=None,
    actual_rul=None
):
    """Create a digital twin state dictionary.
    
    Parameters:
    -----------
    engine_id : int
        Engine identifier
    current_cycle : int
        Current operating cycle
    predicted_rul : float
        Predicted Remaining Useful Life
    anomaly_score : float, optional
        Anomaly detection score
    anomaly_status : str, optional
        Anomaly status (NORMAL/ANOMALOUS)
    anomaly_severity : str, optional
        Anomaly severity (NORMAL/SUSPICIOUS/ANOMALOUS)
    actual_rul : int, optional
        Actual RUL (for evaluation only)
    
    Returns:
    --------
    dict : Digital twin state with JSON-serializable values
    """
    # Health information
    health_percentage = float(get_health_percentage(predicted_rul))
    health_state = get_health_state(predicted_rul)
    
    # Overall status determination
    overall_status = determine_overall_status(
        predicted_rul, 
        health_state,
        anomaly_severity
    )
    
    # Maintenance recommendation
    maintenance_recommendation = get_maintenance_recommendation(overall_status)
    
    # Build state dictionary with Python native types
    state = {
        "engine_id": int(engine_id),
        "current_cycle": int(current_cycle),
        "predicted_rul": float(predicted_rul),
        "health_percentage": health_percentage,
        "health_state": str(health_state),
        "sensor_anomaly_score": float(anomaly_score) if anomaly_score is not None else None,
        "sensor_anomaly_status": str(anomaly_status) if anomaly_status is not None else "NORMAL",
        "sensor_anomaly_severity": str(anomaly_severity) if anomaly_severity is not None else "NORMAL",
        "overall_status": str(overall_status),
        "maintenance_recommendation": str(maintenance_recommendation)
    }
    
    # Add actual RUL for evaluation if provided
    if actual_rul is not None:
        state["actual_rul"] = int(actual_rul)
    
    return state


def determine_overall_status(predicted_rul, health_state, anomaly_severity=None):
    """Determine overall engine status from health and anomaly information.
    
    Logic:
    - If predicted RUL is very low (< 20), always CRITICAL
    - If anomaly is strong (ANOMALOUS), escalate status
    - If anomaly is mild (SUSPICIOUS) and RUL is low, escalate
    - Otherwise use health_state
    
    Parameters:
    -----------
    predicted_rul : float
        Predicted remaining useful life
    health_state : str
        Health state (HEALTHY/MODERATE/WARNING/CRITICAL)
    anomaly_severity : str, optional
        Anomaly severity level
    
    Returns:
    --------
    str : Overall status (HEALTHY/MODERATE/WARNING/CRITICAL)
    """
    if anomaly_severity is None:
        anomaly_severity = "NORMAL"
    
    # Strong anomaly detected - escalate to WARNING/CRITICAL
    if anomaly_severity == "ANOMALOUS":
        if predicted_rul <= 50:
            return "CRITICAL"
        elif predicted_rul <= 80:
            return "WARNING"
        else:
            return "WARNING"
    
    # Mild anomaly - escalate slightly if already concerning
    elif anomaly_severity == "SUSPICIOUS":
        if health_state == "CRITICAL":
            return "CRITICAL"
        elif health_state == "WARNING":
            return "WARNING"
        elif health_state == "MODERATE":
            return "WARNING"
        else:
            return "MODERATE"
    
    # No anomaly - use health state
    else:  # NORMAL
        return health_state


def get_maintenance_recommendation(overall_status):
    """Get maintenance recommendation based on overall status.
    
    Parameters:
    -----------
    overall_status : str
        Overall engine status
    
    Returns:
    --------
    str : Maintenance recommendation
    """
    recommendations = {
        "HEALTHY": "Normal operation",
        "MODERATE": "Continue monitoring",
        "WARNING": "Schedule inspection",
        "CRITICAL": "Immediate maintenance inspection required"
    }
    return recommendations.get(overall_status, "Continue monitoring")


def get_engine_twin(engine_id, features_series, predicted_rul, 
                    current_cycle, anomaly_score=None, anomaly_status=None,
                    anomaly_severity=None, actual_rul=None):
    """Create a digital twin state for a single engine.
    
    Parameters:
    -----------
    engine_id : int
        Engine identifier
    features_series : pd.Series or dict
        Engine sensor data for current cycle
    predicted_rul : float
        Predicted RUL
    current_cycle : int
        Current cycle number
    anomaly_score : float, optional
    anomaly_status : str, optional
    anomaly_severity : str, optional
    actual_rul : int, optional
    
    Returns:
    --------
    dict : Digital twin state
    """
    return create_digital_twin_state(
        engine_id=engine_id,
        current_cycle=current_cycle,
        predicted_rul=predicted_rul,
        anomaly_score=anomaly_score,
        anomaly_status=anomaly_status,
        anomaly_severity=anomaly_severity,
        actual_rul=actual_rul
    )


def batch_create_digital_twins(engine_ids, current_cycles, predicted_ruls,
                               anomaly_scores=None, anomaly_statuses=None,
                               anomaly_severities=None, actual_ruls=None):
    """Create digital twin states for multiple engines.
    
    Parameters:
    -----------
    engine_ids : list or np.ndarray
        Engine identifiers
    current_cycles : list or np.ndarray
        Current cycles
    predicted_ruls : list or np.ndarray
        Predicted RULs
    anomaly_scores : list or np.ndarray, optional
    anomaly_statuses : list or np.ndarray, optional
    anomaly_severities : list or np.ndarray, optional
    actual_ruls : list or np.ndarray, optional
    
    Returns:
    --------
    list of dict : Digital twin states
    """
    # Handle None inputs
    if anomaly_scores is None:
        anomaly_scores = [None] * len(engine_ids)
    if anomaly_statuses is None:
        anomaly_statuses = [None] * len(engine_ids)
    if anomaly_severities is None:
        anomaly_severities = [None] * len(engine_ids)
    if actual_ruls is None:
        actual_ruls = [None] * len(engine_ids)
    
    states = []
    for i in range(len(engine_ids)):
        state = create_digital_twin_state(
            engine_id=engine_ids[i],
            current_cycle=current_cycles[i],
            predicted_rul=predicted_ruls[i],
            anomaly_score=anomaly_scores[i],
            anomaly_status=anomaly_statuses[i],
            anomaly_severity=anomaly_severities[i],
            actual_rul=actual_ruls[i]
        )
        states.append(state)
    
    return states
