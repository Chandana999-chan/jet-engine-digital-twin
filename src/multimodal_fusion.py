"""TASK 20: Decision-Level Multimodal Fusion.

Integrate C-MAPSS RUL model and DGEN 380 acoustic classifier via decision-level fusion
for comprehensive digital twin monitoring.

This module combines:
1. RUL (health estimation) from C-MAPSS model
2. Acoustic state from DGEN 380 classifier
3. Fusion strategy to create unified health assessment
"""

import numpy as np
import pandas as pd
from pathlib import Path
import json
from datetime import datetime
import joblib

from .digital_twin import get_maintenance_recommendation


def fuse_sensor_acoustic_states(sensor_state, acoustic_result=None):
    """Fuse C-MAPSS sensor state and independent DGEN acoustic state.

    Fusion is performed at decision level only. C-MAPSS sensor values and DGEN
    acoustic features are never concatenated because they are independent
    datasets and are not synchronized measurements from the same physical engine.
    """
    acoustic_result = acoustic_result or {}
    sensor_condition = str(sensor_state.get("overall_status", sensor_state.get("health_state", "UNKNOWN")))
    acoustic_condition = str(acoustic_result.get("acoustic_condition", "Not evaluated"))
    sensor_rank = {
        "UNKNOWN": 0,
        "HEALTHY": 1,
        "MODERATE": 2,
        "WARNING": 3,
        "CRITICAL": 4,
    }

    if acoustic_condition == "Not evaluated":
        overall_status = sensor_condition
        reason = "Sensor-only assessment; no acoustic diagnostic recording selected."
        modalities_agree = None
        confidence = "SENSOR_ONLY"
    else:
        acoustic_abnormal = acoustic_condition in {"ABNORMAL", "FAULTY", "ANOMALOUS"}
        acoustic_suspicious = acoustic_condition == "SUSPICIOUS"
        sensor_concerning = sensor_rank.get(sensor_condition, 0) >= sensor_rank["WARNING"]

        if sensor_condition == "CRITICAL":
            overall_status = "CRITICAL"
            reason = "Sensor digital twin is already critical."
        elif acoustic_suspicious and sensor_condition == "HEALTHY":
            overall_status = "MODERATE"
            reason = "Independent acoustic diagnostic is suspicious; continue closer monitoring."
        elif acoustic_suspicious and sensor_condition == "MODERATE":
            overall_status = "WARNING"
            reason = "Moderate sensor condition plus suspicious acoustic diagnostic warrants inspection."
        elif acoustic_suspicious:
            overall_status = sensor_condition
            reason = "Suspicious acoustic diagnostic confirms elevated sensor concern."
        elif acoustic_abnormal and sensor_condition in {"HEALTHY", "MODERATE"}:
            overall_status = "WARNING"
            reason = "Independent acoustic diagnostic is abnormal; inspection is recommended."
        elif acoustic_abnormal and sensor_condition == "WARNING":
            overall_status = "WARNING"
            reason = "Both sensor condition and acoustic diagnostic require attention."
        else:
            overall_status = sensor_condition
            reason = "Acoustic diagnostic does not escalate the sensor digital twin status."

        modalities_agree = sensor_concerning == acoustic_abnormal
        confidence = "MEDIUM" if modalities_agree else "LOW"

    return {
        "timestamp": datetime.now().isoformat(),
        "sensor_condition": sensor_condition,
        "sensor_rul_state": sensor_state.get("health_state"),
        "sensor_anomaly": sensor_state.get("sensor_anomaly_severity"),
        "acoustic_condition": acoustic_condition,
        "acoustic_model_score_probability": acoustic_result.get("model_score_probability"),
        "overall_status": overall_status,
        "maintenance_recommendation": get_maintenance_recommendation(overall_status),
        "reasoning": reason,
        "modalities_agree": modalities_agree,
        "confidence": confidence,
        "fusion_level": "decision",
    }


class MultimodalDigitalTwin:
    """Multimodal digital twin combining RUL and acoustic monitoring."""
    
    def __init__(self, config_path="src/config.py"):
        """Initialize digital twin with RUL and acoustic models.
        
        Parameters:
        -----------
        config_path : str
            Path to configuration module
        """
        self.config = self._load_config(config_path)
        self.rul_model = None
        self.acoustic_model = None
        self.acoustic_scaler = None
        self.feature_cols = None
        self.fusion_results = {}
        
    def _load_config(self, config_path):
        """Load configuration."""
        # For now, return a dict with default values
        return {
            'ANOMALY_THRESHOLD': -0.0413953206,
            'RUL_HEALTHY': 50,
            'RUL_MODERATE': 25,
            'RUL_WARNING': 10,
        }
    
    def load_rul_model(self, model_path="models/rul_model.pkl"):
        """Load pre-trained RUL prediction model."""
        try:
            self.rul_model = joblib.load(model_path)
            print(f"RUL model loaded from {model_path}")
            return True
        except Exception as e:
            print(f"ERROR loading RUL model: {e}")
            return False
    
    def load_acoustic_model(self, model_path="models/acoustic/acoustic_classifier.pkl",
                           scaler_path="models/acoustic/scaler.pkl"):
        """Load acoustic classifier and scaler."""
        try:
            self.acoustic_model = joblib.load(model_path)
            self.acoustic_scaler = joblib.load(scaler_path)
            print(f"Acoustic model loaded from {model_path}")
            print(f"Scaler loaded from {scaler_path}")
            return True
        except Exception as e:
            print(f"ERROR loading acoustic model: {e}")
            return False
    
    def predict_rul(self, sensor_data):
        """Predict RUL using C-MAPSS model.
        
        Parameters:
        -----------
        sensor_data : np.ndarray or pd.DataFrame
            Sensor measurements (14 selected features from C-MAPSS)
        
        Returns:
        --------
        dict with RUL prediction and health state
        """
        if self.rul_model is None:
            return {"status": "error", "message": "RUL model not loaded"}
        
        try:
            rul = float(self.rul_model.predict(sensor_data)[0])
            
            # Determine health state
            if rul >= self.config['RUL_HEALTHY']:
                health_state = 'HEALTHY'
            elif rul >= self.config['RUL_MODERATE']:
                health_state = 'MODERATE'
            elif rul >= self.config['RUL_WARNING']:
                health_state = 'WARNING'
            else:
                health_state = 'CRITICAL'
            
            return {
                'rul': rul,
                'health_state': health_state,
                'confidence': 'high',  # C-MAPSS is configuration-independent
                'model': 'C-MAPSS RUL'
            }
        
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def predict_acoustic_state(self, acoustic_features):
        """Predict acoustic state using DGEN 380 classifier.
        
        Parameters:
        -----------
        acoustic_features : np.ndarray or pd.DataFrame
            37 acoustic features from DGEN 380
        
        Returns:
        --------
        dict with acoustic prediction and caveats
        """
        if self.acoustic_model is None:
            return {"status": "error", "message": "Acoustic model not loaded"}
        
        try:
            # Standardize features
            features_scaled = self.acoustic_scaler.transform(acoustic_features)
            
            # Predict
            prediction = self.acoustic_model.predict(features_scaled)[0]
            probability = self.acoustic_model.predict_proba(features_scaled)[0]
            
            acoustic_state = 'FAULTY' if prediction == 1 else 'NORMAL'
            
            return {
                'acoustic_state': acoustic_state,
                'probability_normal': float(probability[0]),
                'probability_faulty': float(probability[1]),
                'confidence': 'LOW',  # Configuration-specific, not generalizable
                'model': 'DGEN 380 Acoustic',
                'caveat': 'Configuration confounding: may reflect config 2 vs 4 differences, not pure fault detection'
            }
        
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def fuse_decisions(self, rul_result, acoustic_result):
        """Fuse RUL and acoustic decisions at decision level.
        
        Strategy:
        1. Prioritize RUL as primary signal (configuration-independent)
        2. Use acoustic as supporting evidence
        3. Flag disagreement between modalities
        4. Report overall confidence
        
        Parameters:
        -----------
        rul_result : dict
            RUL prediction result
        acoustic_result : dict
            Acoustic prediction result
        
        Returns:
        --------
        dict with fused assessment
        """
        
        fusion = {
            'timestamp': datetime.now().isoformat(),
            'rul_model': rul_result,
            'acoustic_model': acoustic_result,
            'fusion_decision': {},
            'multimodal_status': {}
        }
        
        # Check for errors
        if rul_result.get('status') == 'error' or acoustic_result.get('status') == 'error':
            fusion['fusion_decision']['status'] = 'error'
            fusion['fusion_decision']['message'] = 'One or more models failed'
            return fusion
        
        # Extract predictions
        rul_health = rul_result.get('health_state')
        acoustic_state = acoustic_result.get('acoustic_state')
        
        # Determine overall status
        # Priority: RUL model (configuration-independent)
        if rul_health in ['CRITICAL', 'WARNING']:
            overall_status = rul_health
            reason = f"RUL indicates {rul_health} (RUL={rul_result.get('rul'):.1f} cycles)"
        elif acoustic_state == 'FAULTY' and rul_health in ['MODERATE', 'HEALTHY']:
            overall_status = 'INVESTIGATE'
            reason = "RUL nominal but acoustic model indicates faulty - investigate further"
        elif acoustic_state == 'NORMAL' and rul_health in ['MODERATE', 'WARNING']:
            overall_status = 'CAUTION'
            reason = "RUL degradation with normal acoustics - may indicate gradual degradation"
        else:
            overall_status = rul_health
            reason = f"RUL-based assessment: {rul_health}"
        
        # Agreement analysis
        rul_indicates_fault = rul_health in ['CRITICAL', 'WARNING']
        acoustic_indicates_fault = acoustic_state == 'FAULTY'
        agreement = rul_indicates_fault == acoustic_indicates_fault
        
        fusion['fusion_decision'] = {
            'overall_status': overall_status,
            'reasoning': reason,
            'modality_agreement': agreement,
            'primary_signal': 'RUL (configuration-independent)',
            'secondary_signal': 'Acoustic (configuration-specific)',
            'confidence': 'MEDIUM' if agreement else 'LOW'
        }
        
        # Multimodal summary
        fusion['multimodal_status'] = {
            'rul_status': rul_health,
            'rul_rul_cycles': float(rul_result.get('rul', 0)),
            'acoustic_status': acoustic_state,
            'acoustic_probability_faulty': acoustic_result.get('probability_faulty', 0),
            'modalities_agree': agreement,
            'requires_investigation': not agreement
        }
        
        return fusion
    
    def assess_engine(self, sensor_data, acoustic_features):
        """Complete assessment using all modalities.
        
        Parameters:
        -----------
        sensor_data : np.ndarray or pd.DataFrame
            14 C-MAPSS sensor features
        acoustic_features : np.ndarray or pd.DataFrame
            37 acoustic features from DGEN 380
        
        Returns:
        --------
        dict with complete multimodal assessment
        """
        # RUL prediction
        rul_result = self.predict_rul(sensor_data)
        
        # Acoustic prediction
        acoustic_result = self.predict_acoustic_state(acoustic_features)
        
        # Fuse decisions
        fusion_result = self.fuse_decisions(rul_result, acoustic_result)
        
        return fusion_result
    
    def generate_report(self, fusion_result, output_path=None):
        """Generate human-readable report from fusion result.
        
        Parameters:
        -----------
        fusion_result : dict
            Result from assess_engine()
        output_path : str, optional
            Path to save report
        
        Returns:
        --------
        str : formatted report
        """
        report = []
        report.append("\n" + "=" * 80)
        report.append("MULTIMODAL DIGITAL TWIN ASSESSMENT")
        report.append("=" * 80)
        
        # Overall status
        overall = fusion_result['fusion_decision']['overall_status']
        report.append(f"\nOVERALL STATUS: {overall}")
        report.append(f"Confidence: {fusion_result['fusion_decision']['confidence']}")
        report.append(f"Reasoning: {fusion_result['fusion_decision']['reasoning']}")
        
        # RUL assessment
        report.append("\n" + "-" * 80)
        report.append("1. RUL ASSESSMENT (C-MAPSS Model - Configuration-Independent)")
        report.append("-" * 80)
        rul = fusion_result['rul_model']
        if 'status' not in rul or rul['status'] != 'error':
            report.append(f"Health State: {rul.get('health_state')}")
            report.append(f"RUL: {rul.get('rul'):.1f} cycles")
            report.append(f"Confidence: {rul.get('confidence')}")
        else:
            report.append(f"ERROR: {rul.get('message')}")
        
        # Acoustic assessment
        report.append("\n" + "-" * 80)
        report.append("2. ACOUSTIC ASSESSMENT (DGEN 380 Classifier - Configuration-Specific)")
        report.append("-" * 80)
        acoustic = fusion_result['acoustic_model']
        if 'status' not in acoustic or acoustic['status'] != 'error':
            report.append(f"Acoustic State: {acoustic.get('acoustic_state')}")
            report.append(f"Probability Normal: {acoustic.get('probability_normal'):.3f}")
            report.append(f"Probability Faulty: {acoustic.get('probability_faulty'):.3f}")
            report.append(f"Confidence: {acoustic.get('confidence')}")
            report.append(f"Note: {acoustic.get('caveat')}")
        else:
            report.append(f"ERROR: {acoustic.get('message')}")
        
        # Fusion analysis
        report.append("\n" + "-" * 80)
        report.append("3. FUSION ANALYSIS")
        report.append("-" * 80)
        multimodal = fusion_result['multimodal_status']
        report.append(f"Modalities Agree: {'YES' if multimodal['modalities_agree'] else 'NO'}")
        if not multimodal['modalities_agree']:
            report.append("ACTION: Investigate disagreement between RUL and acoustic signals")
            report.append("  - RUL model is prioritized (configuration-independent)")
            report.append("  - Acoustic model reflects configuration-specific patterns")
            report.append("  - Consider context and configuration differences")
        
        # Recommendations
        report.append("\n" + "-" * 80)
        report.append("4. RECOMMENDATIONS")
        report.append("-" * 80)
        
        if overall == 'CRITICAL':
            report.append("- IMMEDIATE ACTION REQUIRED")
            report.append("- Schedule immediate engine inspection")
            report.append("- Consider emergency maintenance or replacement")
        elif overall == 'WARNING':
            report.append("- Plan maintenance in near term")
            report.append("- Increase monitoring frequency")
            report.append("- Verify RUL prediction with additional diagnostics")
        elif overall == 'INVESTIGATE':
            report.append("- Investigate acoustic anomaly despite nominal RUL")
            report.append("- Possible early indicators of degradation")
            report.append("- Check microphone placement and environmental factors")
        elif overall == 'CAUTION':
            report.append("- Monitor RUL trend closely")
            report.append("- Acoustic state normal, but RUL shows degradation")
            report.append("- May indicate gradual mechanical wear not yet reflected in acoustics")
        else:  # HEALTHY/MODERATE
            report.append("- Continue normal operation")
            report.append("- Maintain routine monitoring")
        
        # Caveats
        report.append("\n" + "-" * 80)
        report.append("IMPORTANT CAVEATS")
        report.append("-" * 80)
        report.append("""
1. CONFIGURATION CONFOUNDING (Acoustic Model)
   - Acoustic classifier trained on different configurations (2 vs 4)
   - Predictions may reflect configuration differences, not pure fault detection
   - Use acoustic model only in fusion, not standalone

2. DATA LIMITATIONS
   - RUL model trained on NASA C-MAPSS simulation data
   - Acoustic model trained on limited DGEN 380 recordings (4 files)
   - Both models may not generalize to all engine conditions

3. MULTIMODAL INTEGRATION
   - RUL model is primary signal (configuration-independent)
   - Acoustic model provides secondary confirmation (configuration-specific)
   - Disagreement between modalities requires investigation

4. DEPLOYMENT CONSIDERATIONS
   - This is a research prototype, not a production system
   - Extensive testing and validation required before deployment
   - Recommend continuous model retraining with operational data
        """)
        
        report.append("=" * 80 + "\n")
        
        report_text = "\n".join(report)
        
        if output_path:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w') as f:
                f.write(report_text)
        
        return report_text


def create_fusion_example():
    """Create an example multimodal assessment."""
    
    print("=" * 80)
    print("MULTIMODAL DIGITAL TWIN - EXAMPLE ASSESSMENT")
    print("=" * 80)
    
    # Initialize twin
    twin = MultimodalDigitalTwin()
    
    # Load models (if available)
    rul_loaded = twin.load_rul_model()
    acoustic_loaded = twin.load_acoustic_model()
    
    if not rul_loaded or not acoustic_loaded:
        print("\nWARNING: Could not load one or more models")
        print("Using mock predictions for demonstration...")
        
        # Mock assessment
        mock_fusion = {
            'timestamp': datetime.now().isoformat(),
            'rul_model': {
                'rul': 25.5,
                'health_state': 'MODERATE',
                'confidence': 'high',
                'model': 'C-MAPSS RUL'
            },
            'acoustic_model': {
                'acoustic_state': 'NORMAL',
                'probability_normal': 0.72,
                'probability_faulty': 0.28,
                'confidence': 'LOW',
                'model': 'DGEN 380 Acoustic',
                'caveat': 'Configuration confounding'
            },
            'fusion_decision': {
                'overall_status': 'CAUTION',
                'reasoning': 'RUL degradation with normal acoustics - monitor closely',
                'modality_agreement': False,
                'confidence': 'LOW'
            },
            'multimodal_status': {
                'rul_status': 'MODERATE',
                'rul_rul_cycles': 25.5,
                'acoustic_status': 'NORMAL',
                'acoustic_probability_faulty': 0.28,
                'modalities_agree': False,
                'requires_investigation': True
            }
        }
        
        report = twin.generate_report(mock_fusion)
        print(report)
        
        return mock_fusion
    
    else:
        print("\nModels loaded successfully!")
        print("Ready for real engine assessments...")
        return None


if __name__ == "__main__":
    fusion_result = create_fusion_example()
