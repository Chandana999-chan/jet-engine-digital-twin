"""Inspect DGEN 380 audio dataset structure.

TASK 1: Enumerate and analyze MAT files
TASK 2: Identify signal channels and sampling rate
"""

import sys
from pathlib import Path
import json
import numpy as np

try:
    from scipy.io import loadmat
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False

try:
    import h5py
    H5PY_AVAILABLE = True
except ImportError:
    H5PY_AVAILABLE = False

# Project paths
project_root = Path(__file__).parent.parent  # Go up from src/ to project root
audio_dir = project_root / "data" / "audio" / "dgen380"
data_dir = project_root / "data"


def inspect_mat_with_scipy(filepath):
    """Inspect a MAT file using scipy.io.loadmat."""
    try:
        data = loadmat(filepath, simplify_cells=True)
        
        # Remove MATLAB metadata
        metadata = {k: v for k, v in data.items() if not k.startswith('__')}
        
        info = {
            'method': 'scipy',
            'format': 'likely_v7.0',
            'variables': {}
        }
        
        for var_name, var_data in metadata.items():
            if isinstance(var_data, np.ndarray):
                info['variables'][var_name] = {
                    'type': str(var_data.dtype),
                    'shape': var_data.shape,
                    'size_mb': var_data.nbytes / (1024 * 1024)
                }
            elif isinstance(var_data, dict):
                info['variables'][var_name] = {
                    'type': 'dict/struct',
                    'keys': list(var_data.keys())
                }
            else:
                info['variables'][var_name] = {
                    'type': str(type(var_data).__name__),
                    'value': str(var_data)[:100]
                }
        
        return info
    except Exception as e:
        return {'error': str(e), 'method': 'scipy'}


def inspect_mat_with_h5py(filepath):
    """Inspect a MAT file using h5py (for v7.3+ HDF5 format)."""
    if not H5PY_AVAILABLE:
        return None
    
    try:
        info = {
            'method': 'h5py',
            'format': 'HDF5_v7.3',
            'groups': {}
        }
        
        with h5py.File(filepath, 'r') as f:
            def visit_function(name, obj):
                if isinstance(obj, h5py.Dataset):
                    info['groups'][name] = {
                        'type': 'dataset',
                        'shape': obj.shape,
                        'dtype': str(obj.dtype)
                    }
                elif isinstance(obj, h5py.Group):
                    info['groups'][name] = {
                        'type': 'group',
                        'contents': list(obj.keys())
                    }
            
            f.visititems(visit_function)
        
        return info
    except Exception as e:
        return None


def main():
    """Main inspection routine."""
    print("=" * 80)
    print("DGEN 380 AUDIO DATASET INSPECTION")
    print("=" * 80)
    
    if not audio_dir.exists():
        print(f"\nError: Audio directory not found: {audio_dir}")
        return False
    
    # List files
    mat_files = sorted(audio_dir.glob("*.mat"))
    print(f"\nFound {len(mat_files)} MAT files:")
    
    for f in mat_files:
        size_mb = f.stat().st_size / (1024 * 1024)
        print(f"  {f.name:50s} {size_mb:8.2f} MB")
    
    # Separate by type
    signal_files = [f for f in mat_files if f.stat().st_size > 100 * 1024 * 1024]
    perfo_files = [f for f in mat_files if f.stat().st_size < 100 * 1024 * 1024]
    
    print(f"\nSignal files (large): {len(signal_files)}")
    for f in signal_files:
        print(f"  {f.name}")
    
    print(f"\nPerformance/metadata files (small): {len(perfo_files)}")
    for f in perfo_files:
        print(f"  {f.name}")
    
    # Analyze one signal file
    if signal_files:
        test_file = signal_files[0]
        print(f"\n" + "=" * 80)
        print(f"DETAILED INSPECTION OF: {test_file.name}")
        print("=" * 80)
        
        # Try scipy first
        if SCIPY_AVAILABLE:
            print(f"\nTrying scipy.io.loadmat()...")
            info = inspect_mat_with_scipy(test_file)
            
            if 'error' in info:
                print(f"  Error: {info['error']}")
            else:
                print(f"  Format: {info.get('format', 'unknown')}")
                print(f"  Variables found: {len(info['variables'])}")
                
                for var_name, var_info in info['variables'].items():
                    print(f"\n  Variable: {var_name}")
                    for key, val in var_info.items():
                        print(f"    {key}: {val}")
        
        # Try h5py if scipy failed
        if H5PY_AVAILABLE and ('error' in info or 'h5py' not in info):
            print(f"\nTrying h5py (HDF5)...")
            h5_info = inspect_mat_with_h5py(test_file)
            
            if h5_info:
                print(f"  Format: {h5_info.get('format', 'HDF5')}")
                print(f"  Groups/datasets found: {len(h5_info['groups'])}")
                
                for name, obj_info in list(h5_info['groups'].items())[:10]:
                    print(f"\n  {name}")
                    for key, val in obj_info.items():
                        print(f"    {key}: {val}")
    
    print("\n" + "=" * 80)
    print("INSPECTION COMPLETE")
    print("=" * 80)
    
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
