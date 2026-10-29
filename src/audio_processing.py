"""Audio signal processing for DGEN 380 turbofan acoustic monitoring.

TASKS 4, 5, 6: Audio loading, preprocessing, segmentation, and feature extraction
from independent DGEN 380 vibroacoustic dataset.

Note: NASA C-MAPSS dataset contains ONLY simulated sensor measurements, not real audio.
This module extends the system with real turbofan acoustic data from DGEN 380.
"""

import numpy as np
import pandas as pd
from pathlib import Path
from typing import Tuple, Dict, List, Optional
import json

try:
    from scipy.io import loadmat
    SCIPY_IO_AVAILABLE = True
except ImportError:
    SCIPY_IO_AVAILABLE = False

try:
    import h5py
    H5PY_AVAILABLE = True
except ImportError:
    H5PY_AVAILABLE = False

try:
    from scipy.fft import fft, fftfreq
    SCIPY_FFT_AVAILABLE = True
except ImportError:
    SCIPY_FFT_AVAILABLE = False

try:
    import scipy.signal
    SCIPY_SIGNAL_AVAILABLE = True
except ImportError:
    SCIPY_SIGNAL_AVAILABLE = False

try:
    import librosa
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False

from .config import AUDIO_DIR


# Default parameters for DGEN 380
DEFAULT_WINDOW_DURATION = 2.0  # seconds
DEFAULT_WINDOW_OVERLAP = 0.5  # 50% overlap
DGEN_SAMPLING_RATE = 40960.0  # Hz


def load_dgen_mat(filepath: str) -> Dict:
    """Load a DGEN 380 MAT file and extract signal information.
    
    Parameters:
    -----------
    filepath : str
        Path to MAT file
    
    Returns:
    --------
    dict with keys:
        - microphone_signals: dict of microphone channels
        - accelerometer_signals: dict of accelerometer channels
        - sampling_rate: sampling frequency in Hz
        - duration: recording duration in seconds
        - parameters: metadata parameters
        - time_vector: time array
        - num_samples: number of samples
    """
    if not SCIPY_IO_AVAILABLE:
        raise ImportError("scipy.io required to load MAT files")
    
    filepath = Path(filepath)
    if not filepath.exists():
        raise FileNotFoundError(f"File not found: {filepath}")
    
    # Load MAT file
    mat_data = loadmat(filepath, simplify_cells=True)
    
    # Extract sampling rate from parameters
    sampling_rate = None
    if 'Parametres' in mat_data:
        params_str = mat_data['Parametres']
        if isinstance(params_str, str) and 'Sampling frequency' in params_str:
            # Parse "Sampling frequency =40960 Hz, ..."
            try:
                sr_str = params_str.split('=')[1].split('Hz')[0].strip()
                sampling_rate = float(sr_str)
            except:
                pass
    
    if sampling_rate is None:
        # Default for DGEN 380
        sampling_rate = DGEN_SAMPLING_RATE
    
    # Extract microphone signals (mic1 through mic11)
    microphone_signals = {}
    microphone_channels = ['mic1', 'mic2', 'mic3', 'mic4', 'mic5', 'mic6',
                          'mic7', 'mic8', 'mic9', 'mic10', 'mic11']
    
    for mic_name in microphone_channels:
        if mic_name in mat_data:
            microphone_signals[mic_name] = np.asarray(mat_data[mic_name], dtype=np.float64)
    
    # Extract accelerometer signals (acc1/2/3 with X/Y/Z axes)
    accelerometer_signals = {}
    for acc_num in ['1', '2', '3']:
        for axis in ['X', 'Y', 'Z']:
            acc_key = f'acc{acc_num}_{axis}'
            if acc_key in mat_data:
                accelerometer_signals[acc_key] = np.asarray(mat_data[acc_key], dtype=np.float64)
    
    # Extract time vector
    time_vector = None
    if 't' in mat_data:
        time_vector = np.asarray(mat_data['t'], dtype=np.float64)
    
    # Calculate duration
    if microphone_signals:
        first_signal = list(microphone_signals.values())[0]
        duration = len(first_signal) / sampling_rate
    elif time_vector is not None:
        duration = float(time_vector[-1])
    else:
        duration = None
    
    return {
        'microphone_signals': microphone_signals,
        'accelerometer_signals': accelerometer_signals,
        'sampling_rate': sampling_rate,
        'duration': duration,
        'parameters': mat_data.get('Parametres', ''),
        'time_vector': time_vector,
        'num_samples': len(first_signal) if microphone_signals else None
    }


def inspect_mat_structure(filepath: str) -> Dict:
    """Inspect a MAT file without assuming a fixed channel layout."""
    filepath = Path(filepath)
    if not filepath.exists():
        raise FileNotFoundError(f"File not found: {filepath}")

    if SCIPY_IO_AVAILABLE:
        try:
            mat_data = loadmat(filepath, simplify_cells=True)
            variables = {}
            for key, value in mat_data.items():
                if key.startswith("__"):
                    continue
                if isinstance(value, np.ndarray):
                    variables[key] = {
                        "kind": "ndarray",
                        "shape": list(value.shape),
                        "dtype": str(value.dtype),
                    }
                else:
                    variables[key] = {
                        "kind": type(value).__name__,
                        "preview": str(value)[:120],
                    }
            return {
                "filename": filepath.name,
                "format": "MATLAB v7 or earlier",
                "loader": "scipy.io.loadmat",
                "top_level_keys": sorted(variables.keys()),
                "variables": variables,
            }
        except NotImplementedError:
            pass

    if H5PY_AVAILABLE:
        variables = {}
        with h5py.File(filepath, "r") as handle:
            def visit(name, obj):
                if isinstance(obj, h5py.Dataset):
                    variables[name] = {
                        "kind": "dataset",
                        "shape": list(obj.shape),
                        "dtype": str(obj.dtype),
                    }
                elif isinstance(obj, h5py.Group):
                    variables[name] = {
                        "kind": "group",
                        "keys": list(obj.keys()),
                    }

            handle.visititems(visit)
        return {
            "filename": filepath.name,
            "format": "MATLAB v7.3/HDF5",
            "loader": "h5py",
            "top_level_keys": sorted(variables.keys()),
            "variables": variables,
        }

    raise ImportError("scipy.io or h5py is required to inspect MAT files")


def get_sampling_rate(recording_data: Dict) -> float:
    """Return verified sampling rate from loaded DGEN metadata."""
    sampling_rate = recording_data.get("sampling_rate")
    if sampling_rate is None or float(sampling_rate) <= 0:
        raise ValueError("Valid sampling rate is unavailable")
    return float(sampling_rate)


def get_microphone_signal(recording_data: Dict, channel: str = "mic1") -> np.ndarray:
    """Return a verified microphone signal by channel name."""
    microphone_signals = recording_data.get("microphone_signals", {})
    if channel not in microphone_signals:
        available = ", ".join(sorted(microphone_signals.keys()))
        raise KeyError(f"Microphone channel {channel} not found. Available: {available}")
    return np.asarray(microphone_signals[channel], dtype=np.float64)


def get_accelerometer_signal(recording_data: Dict, channel: str = "acc1_X") -> np.ndarray:
    """Return a verified accelerometer/vibration signal by channel name."""
    accelerometer_signals = recording_data.get("accelerometer_signals", {})
    if channel not in accelerometer_signals:
        available = ", ".join(sorted(accelerometer_signals.keys()))
        raise KeyError(f"Accelerometer channel {channel} not found. Available: {available}")
    return np.asarray(accelerometer_signals[channel], dtype=np.float64)


def preprocess_signal(signal: np.ndarray, 
                     remove_dc: bool = True,
                     handle_nans: bool = True) -> np.ndarray:
    """Preprocess audio signal.
    
    Parameters:
    -----------
    signal : np.ndarray
        Raw signal array
    remove_dc : bool
        Remove DC offset (mean)
    handle_nans : bool
        Replace NaN/inf with safe values
    
    Returns:
    --------
    np.ndarray : Preprocessed signal
    """
    signal = np.asarray(signal, dtype=np.float64)
    
    # Handle NaN and inf
    if handle_nans:
        signal = np.where(np.isfinite(signal), signal, 0.0)
    
    # Remove DC offset
    if remove_dc:
        signal = signal - np.mean(signal)
    
    return signal


def clean_signal(signal: np.ndarray, remove_dc: bool = True) -> np.ndarray:
    """Alias for preprocessing used by backend/API code."""
    return preprocess_signal(signal, remove_dc=remove_dc, handle_nans=True)


def segment_signal(signal: np.ndarray,
                  sampling_rate: float,
                  window_duration: float = DEFAULT_WINDOW_DURATION,
                  overlap: float = DEFAULT_WINDOW_OVERLAP) -> List[np.ndarray]:
    """Segment signal into fixed-size windows.
    
    Parameters:
    -----------
    signal : np.ndarray
        Audio signal
    sampling_rate : float
        Sampling rate in Hz
    window_duration : float
        Window duration in seconds
    overlap : float
        Overlap fraction (0 to 1)
    
    Returns:
    --------
    list of np.ndarray : Signal windows
    """
    window_samples = int(window_duration * sampling_rate)
    step_samples = int(window_samples * (1 - overlap))
    
    segments = []
    start = 0
    
    while start + window_samples <= len(signal):
        segment = signal[start:start + window_samples]
        segments.append(segment)
        start += step_samples
    
    return segments


def segment_signal_with_metadata(signal: np.ndarray,
                                 sampling_rate: float,
                                 source_file: str,
                                 group_id: str,
                                 label: Optional[int],
                                 channel: str,
                                 window_duration: float = DEFAULT_WINDOW_DURATION,
                                 overlap: float = DEFAULT_WINDOW_OVERLAP) -> List[Dict]:
    """Segment a signal and retain source/group metadata for leakage-safe ML."""
    window_samples = int(window_duration * sampling_rate)
    step_samples = int(window_samples * (1 - overlap))

    windows = []
    start = 0
    window_idx = 0
    while start + window_samples <= len(signal):
        end = start + window_samples
        windows.append({
            "source_file": source_file,
            "group_id": group_id,
            "label": label,
            "channel": channel,
            "window_idx": window_idx,
            "start_sample": int(start),
            "end_sample": int(end),
            "signal": signal[start:end],
        })
        window_idx += 1
        start += step_samples

    return windows


def compute_fft(signal: np.ndarray,
                sampling_rate: float) -> Tuple[np.ndarray, np.ndarray]:
    """Compute one-sided FFT magnitude for a signal window."""
    if not SCIPY_FFT_AVAILABLE:
        raise ImportError("scipy.fft is required for FFT computation")

    signal = clean_signal(signal)
    frequencies = fftfreq(len(signal), 1 / sampling_rate)[:len(signal) // 2]
    magnitudes = np.abs(fft(signal))[:len(signal) // 2]
    return frequencies, magnitudes


def compute_stft(signal: np.ndarray,
                 sampling_rate: float,
                 nperseg: Optional[int] = None) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Compute STFT magnitude in dB for a signal segment."""
    if not SCIPY_SIGNAL_AVAILABLE:
        raise ImportError("scipy.signal is required for STFT computation")

    signal = clean_signal(signal)
    if nperseg is None:
        nperseg = int(sampling_rate * 0.1)
    frequencies, times, zxx = scipy.signal.stft(signal, fs=sampling_rate, nperseg=nperseg)
    magnitude_db = 20 * np.log10(np.abs(zxx) + 1e-10)
    return frequencies, times, magnitude_db


def extract_audio_features(signal: np.ndarray,
                          sampling_rate: float) -> Dict[str, float]:
    """Extract acoustic features from a signal window.
    
    FEATURES:
    - Time-domain: RMS energy, peak amplitude, crest factor, zero crossing rate
    - Statistical: kurtosis, skewness
    - Spectral: centroid, dominant frequency, bandwidth, rolloff, flatness
    - MFCC: 13 mel-frequency cepstral coefficients (mean and std)
    
    Parameters:
    -----------
    signal : np.ndarray
        Audio window
    sampling_rate : float
        Sampling rate in Hz
    
    Returns:
    --------
    dict with feature values
    """
    signal = np.asarray(signal, dtype=np.float64)
    signal = np.where(np.isfinite(signal), signal, 0.0)
    
    features = {}
    
    # Time-domain features
    features['rms_energy'] = float(np.sqrt(np.mean(signal ** 2)))
    features['peak_amplitude'] = float(np.max(np.abs(signal)))
    features['variance'] = float(np.var(signal))
    features['standard_deviation'] = float(np.std(signal))
    rms_val = np.sqrt(np.mean(signal ** 2))
    features['crest_factor'] = float(np.max(np.abs(signal)) / (rms_val + 1e-10))
    
    # Zero crossing rate
    zero_crossings = np.sum(np.abs(np.diff(np.sign(signal)))) / 2
    features['zero_crossing_rate'] = float(zero_crossings / len(signal))
    
    # Statistical features
    mean_val = np.mean(signal)
    std_val = np.std(signal)
    features['kurtosis'] = float(np.mean((signal - mean_val) ** 4) / ((std_val ** 4) + 1e-10))
    features['skewness'] = float(np.mean((signal - mean_val) ** 3) / ((std_val ** 3) + 1e-10))
    
    # Spectral features
    if SCIPY_FFT_AVAILABLE and SCIPY_SIGNAL_AVAILABLE:
        try:
            fft_vals = np.abs(fft(signal))
            freqs = fftfreq(len(signal), 1 / sampling_rate)[:len(signal) // 2]
            fft_vals = fft_vals[:len(signal) // 2]
            
            # Spectral centroid
            if np.sum(fft_vals) > 0:
                spectral_centroid = np.sum(freqs * fft_vals) / np.sum(fft_vals)
            else:
                spectral_centroid = 0.0
            features['spectral_centroid'] = float(spectral_centroid)
            
            # Dominant frequency
            dominant_idx = np.argmax(fft_vals)
            features['dominant_frequency'] = float(freqs[dominant_idx])
            
            # Spectral bandwidth
            power_below_centroid = np.sum(fft_vals[freqs < spectral_centroid])
            total_power = np.sum(fft_vals)
            if total_power > 0:
                spectral_bandwidth = np.sqrt(np.sum((freqs - spectral_centroid) ** 2 * fft_vals) / total_power)
            else:
                spectral_bandwidth = 0.0
            features['spectral_bandwidth'] = float(spectral_bandwidth)
            
            # Spectral rolloff (95% energy)
            cumsum = np.cumsum(fft_vals)
            rolloff_idx = np.where(cumsum > 0.95 * np.sum(fft_vals))[0]
            if len(rolloff_idx) > 0:
                spectral_rolloff = freqs[rolloff_idx[0]]
            else:
                spectral_rolloff = freqs[-1] if len(freqs) > 0 else 0.0
            features['spectral_rolloff'] = float(spectral_rolloff)
            
            # Spectral flatness
            geometric_mean = np.exp(np.mean(np.log(fft_vals + 1e-10)))
            arithmetic_mean = np.mean(fft_vals)
            spectral_flatness = geometric_mean / (arithmetic_mean + 1e-10)
            features['spectral_flatness'] = float(spectral_flatness)
            features['spectral_energy'] = float(np.sum(fft_vals ** 2) / len(fft_vals))
        except:
            features['spectral_centroid'] = 0.0
            features['dominant_frequency'] = 0.0
            features['spectral_bandwidth'] = 0.0
            features['spectral_rolloff'] = 0.0
            features['spectral_flatness'] = 0.0
            features['spectral_energy'] = 0.0
    else:
        features['spectral_centroid'] = 0.0
        features['dominant_frequency'] = 0.0
        features['spectral_bandwidth'] = 0.0
        features['spectral_rolloff'] = 0.0
        features['spectral_flatness'] = 0.0
        features['spectral_energy'] = 0.0
    
    # MFCCs (13 coefficients with mean and std)
    if LIBROSA_AVAILABLE:
        try:
            mfccs = librosa.feature.mfcc(y=signal, sr=sampling_rate, n_mfcc=13)
            mfcc_mean = np.mean(mfccs, axis=1)
            mfcc_std = np.std(mfccs, axis=1)
            
            for i in range(13):
                features[f'mfcc_{i+1}_mean'] = float(mfcc_mean[i])
                features[f'mfcc_{i+1}_std'] = float(mfcc_std[i])
        except:
            # If MFCC fails, set to 0
            for i in range(13):
                features[f'mfcc_{i+1}_mean'] = 0.0
                features[f'mfcc_{i+1}_std'] = 0.0
    else:
        # Placeholder MFCC values if librosa not available
        for i in range(13):
            features[f'mfcc_{i+1}_mean'] = 0.0
            features[f'mfcc_{i+1}_std'] = 0.0
    
    return features


def compute_spectrogram(signal: np.ndarray,
                       sampling_rate: float,
                       window: str = 'hann',
                       nperseg: Optional[int] = None) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Compute spectrogram of signal.
    
    Parameters:
    -----------
    signal : np.ndarray
        Audio signal
    sampling_rate : float
        Sampling rate in Hz
    window : str
        Window type for STFT
    nperseg : int, optional
        Samples per segment
    
    Returns:
    --------
    tuple of (freqs, times, Sxx_db)
        freqs : frequency array
        times : time array
        Sxx_db : spectrogram in dB
    """
    if not SCIPY_SIGNAL_AVAILABLE:
        return None, None, None
    
    if nperseg is None:
        nperseg = int(sampling_rate * 0.1)  # 100ms windows
    
    try:
        f, t, Sxx = scipy.signal.spectrogram(signal, fs=sampling_rate,
                                            window=window, nperseg=nperseg)
        
        # Convert to dB
        Sxx_db = 10 * np.log10(Sxx + 1e-10)
        
        return f, t, Sxx_db
    except:
        return None, None, None


def extract_features_from_file(filepath: str,
                              window_duration: float = DEFAULT_WINDOW_DURATION,
                              overlap: float = DEFAULT_WINDOW_OVERLAP,
                              microphone_channels: Optional[List[str]] = None) -> pd.DataFrame:
    """Extract features from all microphone channels in a file.
    
    Parameters:
    -----------
    filepath : str
        Path to MAT file
    window_duration : float
        Window duration in seconds
    overlap : float
        Overlap fraction
    microphone_channels : list, optional
        Specific channels to process (default: all)
    
    Returns:
    --------
    pd.DataFrame : Features for each window
    """
    # Load file
    data = load_dgen_mat(filepath)
    sampling_rate = data['sampling_rate']
    microphone_signals = data['microphone_signals']
    
    if not microphone_channels:
        microphone_channels = list(microphone_signals.keys())
    
    # Extract features from all channels
    feature_list = []
    
    for channel_name in microphone_channels:
        if channel_name not in microphone_signals:
            continue
        
        signal = microphone_signals[channel_name]
        signal = preprocess_signal(signal)
        
        # Segment signal
        windows = segment_signal(signal, sampling_rate, window_duration, overlap)
        
        # Extract features for each window
        for window_idx, window in enumerate(windows):
            features = extract_audio_features(window, sampling_rate)
            features['source_file'] = str(Path(filepath).name)
            features['channel'] = channel_name
            features['window_idx'] = window_idx
            feature_list.append(features)
    
    return pd.DataFrame(feature_list)


# Legacy function for compatibility
def extract_audio_features_legacy(audio_path, sr=None):
    """Extract acoustic features from a standard audio file (.wav, .mp3, etc).
    
    Legacy function for compatibility with C-MAPSS dashboard.
    Used if real audio files are provided.
    
    Parameters:
    -----------
    audio_path : str or Path
        Path to audio file (.wav, .mp3, etc.)
    sr : int, optional
        Sample rate. If None, librosa will use default
    
    Returns:
    --------
    dict with extracted features or None if audio is unavailable
    """
    if not LIBROSA_AVAILABLE:
        return None
    
    try:
        # Load audio
        y, sr = librosa.load(audio_path, sr=sr)
        
        # Basic time-domain features
        rms = librosa.feature.rms(y=y)[0]
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        
        # Spectral features
        spec_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        spec_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
        spec_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
        
        # MFCCs
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        
        # Dominant frequency
        fft = np.abs(np.fft.fft(y))
        freqs = np.fft.fftfreq(len(y), 1/sr)
        dominant_freq = freqs[np.argmax(fft[:len(fft)//2])]
        
        # Aggregate features
        features = {
            'audio_duration': len(y) / sr,
            'sample_rate': sr,
            'rms_energy_mean': float(np.mean(rms)),
            'rms_energy_std': float(np.std(rms)),
            'zero_crossing_rate_mean': float(np.mean(zcr)),
            'zero_crossing_rate_std': float(np.std(zcr)),
            'spectral_centroid_mean': float(np.mean(spec_centroid)),
            'spectral_centroid_std': float(np.std(spec_centroid)),
            'spectral_bandwidth_mean': float(np.mean(spec_bandwidth)),
            'spectral_bandwidth_std': float(np.std(spec_bandwidth)),
            'spectral_rolloff_mean': float(np.mean(spec_rolloff)),
            'spectral_rolloff_std': float(np.std(spec_rolloff)),
            'mfcc_mean': [float(x) for x in np.mean(mfcc, axis=1)],
            'mfcc_std': [float(x) for x in np.std(mfcc, axis=1)],
            'dominant_frequency': float(dominant_freq)
        }
        
        return features
    
    except Exception as e:
        print(f"Error extracting features from {audio_path}: {e}")
        return None


def get_spectrogram(audio_path, sr=None):
    """Generate spectrogram data for visualization.
    
    Parameters:
    -----------
    audio_path : str or Path
        Path to audio file
    sr : int, optional
        Sample rate
    
    Returns:
    --------
    dict with S (spectrogram), freq, time arrays or None
    """
    if not LIBROSA_AVAILABLE:
        return None
    
    try:
        y, sr = librosa.load(audio_path, sr=sr)
        S = librosa.feature.melspectrogram(y=y, sr=sr)
        S_db = librosa.power_to_db(S, ref=np.max)
        
        # Get time and frequency axes
        times = librosa.frames_to_time(np.arange(S_db.shape[1]), sr=sr)
        freqs = librosa.mel_frequencies(n_mels=S_db.shape[0], fmin=0, fmax=sr/2)
        
        return {
            'spectrogram': S_db.tolist(),
            'frequencies': freqs.tolist(),
            'times': times.tolist(),
            'sample_rate': sr
        }
    
    except Exception as e:
        print(f"Error generating spectrogram from {audio_path}: {e}")
        return None


def check_audio_data_available():
    """Check if real audio data exists in the project."""
    if not AUDIO_DIR.exists():
        return False, []
    
    audio_files = list(AUDIO_DIR.glob('**/*.wav')) + \
                  list(AUDIO_DIR.glob('**/*.mp3')) + \
                  list(AUDIO_DIR.glob('**/*.flac')) + \
                  list(AUDIO_DIR.glob('**/*.mat'))
    
    return len(audio_files) > 0, audio_files


def get_audio_dataset_info():
    """Get information about available audio dataset."""
    available, files = check_audio_data_available()
    
    if not available:
        return {
            'available': False,
            'message': 'No real turbofan acoustic dataset is currently installed.',
            'files': []
        }
    
    return {
        'available': True,
        'count': len(files),
        'files': [str(f) for f in files]
    }


if __name__ == "__main__":
    # Example usage for DGEN 380
    print("DGEN 380 Audio Processing Module")
    print("=" * 50)
    
    audio_dir = Path("data/audio/dgen380")
    if audio_dir.exists():
        mat_files = list(audio_dir.glob("*.mat"))
        print(f"Found {len(mat_files)} MAT files")
        
        if mat_files:
            print(f"\nProcessing: {mat_files[0].name}")
            data = load_dgen_mat(str(mat_files[0]))
            print(f"  Sampling rate: {data['sampling_rate']} Hz")
            print(f"  Duration: {data['duration']:.2f} seconds")
            print(f"  Microphone channels: {len(data['microphone_signals'])}")
            print(f"  Accelerometer channels: {len(data['accelerometer_signals'])}")
    else:
        print("Audio directory not found: data/audio/dgen380")

