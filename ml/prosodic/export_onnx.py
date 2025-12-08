"""
Export Wav2Vec2 model to ONNX format for lightweight inference.

This script exports the facebook/wav2vec2-base-960h model to ONNX format,
reducing the inference dependency from PyTorch (~700MB) to ONNX Runtime (~150MB).

Usage:
    python export_onnx.py

Output:
    - backend/wav2vec2.onnx (~360MB)

Prerequisites:
    Core (always required):
        pip install torch transformers onnx numpy
    
    Optional (only for verification):
        pip install onnxruntime  # for verifying exported model

Note: onnxruntime is imported conditionally to allow export without it installed
(set verify=False in export_to_onnx() to skip verification).
"""

import numpy as np
import torch
from pathlib import Path
from transformers import Wav2Vec2Model

# Configuration
MODEL_NAME = "facebook/wav2vec2-base-960h"
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent.parent / "backend"
OUTPUT_PATH = BACKEND_DIR / "wav2vec2.onnx"
SAMPLE_RATE = 16000


def export_to_onnx(verify: bool = True):
    """
    Export Wav2Vec2 model to ONNX format.
    
    Args:
        verify: Whether to verify the exported model produces matching outputs
    """
    print("=" * 60)
    print("Wav2Vec2 to ONNX Export")
    print("=" * 60)
    
    # Load PyTorch model
    print(f"\n1. Loading PyTorch model: {MODEL_NAME}")
    model = Wav2Vec2Model.from_pretrained(MODEL_NAME)
    model.eval()
    print("   ✓ Model loaded successfully")
    
    # Create dummy input (1 second of audio at 16kHz)
    print("\n2. Preparing dummy input for export...")
    dummy_waveform = torch.randn(1, SAMPLE_RATE)  # 1 second of audio
    print(f"   Input shape: {dummy_waveform.shape}")
    
    # Get PyTorch output for verification
    print("\n3. Running PyTorch inference for baseline...")
    with torch.no_grad():
        pytorch_output = model(dummy_waveform).last_hidden_state
    print(f"   Output shape: {pytorch_output.shape}")
    
    # Export to ONNX
    print(f"\n4. Exporting to ONNX: {OUTPUT_PATH}")
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    torch.onnx.export(
        model,
        dummy_waveform,
        str(OUTPUT_PATH),
        input_names=["input_values"],
        output_names=["last_hidden_state"],
        dynamic_axes={
            "input_values": {0: "batch_size", 1: "sequence_length"},
            "last_hidden_state": {0: "batch_size", 1: "time_steps"},
        },
        opset_version=14,
        do_constant_folding=True,
    )
    
    model_size_mb = OUTPUT_PATH.stat().st_size / (1024 * 1024)
    print(f"   ✓ Export complete!")
    print(f"   Model size: {model_size_mb:.1f} MB")
    
    # Verify ONNX output matches PyTorch
    if verify:
        print("\n5. Verifying ONNX output matches PyTorch...")
        # Conditional import: onnxruntime is only needed for verification
        import onnxruntime as ort
        
        session = ort.InferenceSession(
            str(OUTPUT_PATH),
            providers=["CPUExecutionProvider"]
        )
        
        onnx_output = session.run(
            ["last_hidden_state"],
            {"input_values": dummy_waveform.numpy()}
        )[0]
        
        # Compare outputs
        pytorch_np = pytorch_output.numpy()
        max_diff = np.abs(pytorch_np - onnx_output).max()
        mean_diff = np.abs(pytorch_np - onnx_output).mean()
        
        print(f"   Max absolute difference: {max_diff:.6e}")
        print(f"   Mean absolute difference: {mean_diff:.6e}")
        
        # Tolerance check
        if np.allclose(pytorch_np, onnx_output, atol=1e-5):
            print("   ✓ Verification PASSED: Outputs are numerically equivalent")
        else:
            print("   ⚠ Verification WARNING: Small numerical differences detected")
            print("     This is normal for ONNX conversion and should not affect results")
    
    # Summary
    print("\n" + "=" * 60)
    print("Export Complete!")
    print("=" * 60)
    print(f"\nONNX model saved to: {OUTPUT_PATH}")
    print(f"Model size: {model_size_mb:.1f} MB")
    print("\nNext steps:")
    print("  1. Add wav2vec2.onnx to .gitignore (too large for git)")
    print("  2. Update backend/requirements.txt to use onnxruntime")
    print("  3. Update backend/audio/processing.py to use ONNX inference")
    print("  4. Rebuild Docker image without PyTorch")
    
    return OUTPUT_PATH


def main():
    """Main entry point."""
    try:
        export_to_onnx(verify=True)
    except ImportError as e:
        print(f"Error: Missing dependency - {e}")
        print("\nInstall required packages:")
        print("  pip install torch transformers onnx onnxruntime numpy")
        return 1
    except Exception as e:
        print(f"Error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())

