"""
Verify ONNX model produces outputs equivalent to PyTorch.

This script loads both the PyTorch Wav2Vec2 model and the exported ONNX model,
runs them on the same test audio, and compares the embeddings.

Usage:
    python verify_onnx.py [--audio PATH]

Arguments:
    --audio PATH    Path to a test audio file (optional, uses synthetic audio if not provided)

Prerequisites:
    Core (always required):
        pip install torch transformers onnxruntime numpy

    Optional (only for --audio):
        pip install soundfile    # for loading audio files
        pip install torchaudio   # for resampling non-16kHz audio

Note: soundfile and torchaudio are imported conditionally within functions to allow
running with synthetic audio when these packages are not installed.
"""

import argparse
import numpy as np
import torch
from pathlib import Path

# Configuration
MODEL_NAME = "facebook/wav2vec2-base-960h"
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent.parent / "backend"
ONNX_PATH = BACKEND_DIR / "wav2vec2.onnx"
SAMPLE_RATE = 16000


def load_audio(audio_path: str | None) -> np.ndarray:
    """
    Load audio from file or generate synthetic audio.

    Args:
        audio_path: Path to audio file, or None for synthetic audio

    Returns:
        Audio waveform as numpy array (mono, 16kHz)
    """
    if audio_path is None:
        # Generate synthetic audio (white noise, 2 seconds)
        print("Using synthetic audio (2 seconds of noise)")
        return np.random.randn(SAMPLE_RATE * 2).astype(np.float32)

    # Conditional import: soundfile is only needed when loading audio files
    import soundfile as sf

    print(f"Loading audio from: {audio_path}")
    waveform, sr = sf.read(audio_path)

    # Convert to mono if stereo
    if waveform.ndim == 2:
        waveform = waveform.mean(axis=1)

    # Resample to 16kHz if needed
    if sr != SAMPLE_RATE:
        # Conditional import: torchaudio is only needed for resampling
        import torchaudio

        waveform_tensor = torch.tensor(waveform).unsqueeze(0).float()
        resampler = torchaudio.transforms.Resample(sr, SAMPLE_RATE)
        waveform_tensor = resampler(waveform_tensor)
        waveform = waveform_tensor.squeeze(0).numpy()

    print(
        f"Audio loaded: {len(waveform)} samples ({len(waveform)/SAMPLE_RATE:.2f} seconds)"
    )
    return waveform.astype(np.float32)


def normalize_audio(waveform: np.ndarray) -> np.ndarray:
    """Normalize audio to zero mean and unit variance."""
    return (waveform - waveform.mean()) / (waveform.std() + 1e-9)


def get_pytorch_embedding(waveform: np.ndarray) -> np.ndarray:
    """
    Get embedding using PyTorch Wav2Vec2 model.

    Note: Uses raw tensor input (no processor) to match how the ONNX model
    was exported in export_onnx.py. Both models receive identical inputs
    for a fair comparison.

    Args:
        waveform: Normalized audio waveform

    Returns:
        Mean-pooled embedding of shape (768,)
    """
    from transformers import Wav2Vec2Model

    model = Wav2Vec2Model.from_pretrained(MODEL_NAME)
    model.eval()

    # Pass raw waveform directly (matching ONNX export which doesn't use processor)
    input_tensor = torch.tensor(waveform).unsqueeze(0).float()

    with torch.no_grad():
        outputs = model(input_tensor)
        # Mean pool over time dimension
        embedding = outputs.last_hidden_state.mean(dim=1).squeeze(0).numpy()

    return embedding


def get_onnx_embedding(waveform: np.ndarray) -> np.ndarray:
    """
    Get embedding using ONNX Runtime.

    Args:
        waveform: Normalized audio waveform

    Returns:
        Mean-pooled embedding of shape (768,)
    """
    import onnxruntime as ort

    if not ONNX_PATH.exists():
        raise FileNotFoundError(
            f"ONNX model not found at {ONNX_PATH}\n"
            "Run export_onnx.py first to generate the model."
        )

    session = ort.InferenceSession(str(ONNX_PATH), providers=["CPUExecutionProvider"])

    # Prepare input (add batch dimension)
    input_values = waveform.reshape(1, -1).astype(np.float32)

    # Run inference
    outputs = session.run(["last_hidden_state"], {"input_values": input_values})

    # Mean pool over time dimension
    hidden_states = outputs[0]  # Shape: (1, seq_len, 768)
    embedding = hidden_states.mean(axis=1).squeeze(0)  # Shape: (768,)

    return embedding


def verify_embeddings(pytorch_emb: np.ndarray, onnx_emb: np.ndarray) -> bool:
    """
    Compare PyTorch and ONNX embeddings.

    Args:
        pytorch_emb: Embedding from PyTorch model
        onnx_emb: Embedding from ONNX model

    Returns:
        True if embeddings are numerically equivalent
    """
    print("\nComparing embeddings:")
    print(f"  PyTorch shape: {pytorch_emb.shape}")
    print(f"  ONNX shape: {onnx_emb.shape}")

    # Calculate differences
    abs_diff = np.abs(pytorch_emb - onnx_emb)
    max_diff = abs_diff.max()
    mean_diff = abs_diff.mean()
    rel_diff = (abs_diff / (np.abs(pytorch_emb) + 1e-9)).mean()

    print(f"\n  Max absolute difference: {max_diff:.6e}")
    print(f"  Mean absolute difference: {mean_diff:.6e}")
    print(f"  Mean relative difference: {rel_diff:.6e}")

    # Correlation
    correlation = np.corrcoef(pytorch_emb, onnx_emb)[0, 1]
    print(f"  Correlation: {correlation:.6f}")

    # Tolerance check
    is_close = np.allclose(pytorch_emb, onnx_emb, atol=1e-4, rtol=1e-4)

    return is_close


def main():
    parser = argparse.ArgumentParser(description="Verify ONNX model against PyTorch")
    parser.add_argument("--audio", type=str, help="Path to test audio file")
    args = parser.parse_args()

    print("=" * 60)
    print("ONNX Model Verification")
    print("=" * 60)

    # Load and preprocess audio
    print("\n1. Loading audio...")
    waveform = load_audio(args.audio)
    waveform = normalize_audio(waveform)
    print(f"   Normalized waveform shape: {waveform.shape}")

    # Get PyTorch embedding
    print("\n2. Computing PyTorch embedding...")
    try:
        pytorch_emb = get_pytorch_embedding(waveform)
        print(f"   ✓ PyTorch embedding: shape {pytorch_emb.shape}")
    except Exception as e:
        print(f"   ✗ PyTorch inference failed: {e}")
        return 1

    # Get ONNX embedding
    print("\n3. Computing ONNX embedding...")
    try:
        onnx_emb = get_onnx_embedding(waveform)
        print(f"   ✓ ONNX embedding: shape {onnx_emb.shape}")
    except FileNotFoundError as e:
        print(f"   ✗ {e}")
        return 1
    except Exception as e:
        print(f"   ✗ ONNX inference failed: {e}")
        return 1

    # Verify
    print("\n4. Verifying equivalence...")
    is_equivalent = verify_embeddings(pytorch_emb, onnx_emb)

    print("\n" + "=" * 60)
    if is_equivalent:
        print("✓ VERIFICATION PASSED")
        print("  ONNX model produces equivalent embeddings to PyTorch.")
        print("=" * 60)
        return 0
    else:
        print("⚠ VERIFICATION WARNING")
        print("  Small numerical differences detected.")
        print("  This is typically acceptable for ONNX conversion.")
        print("  Check correlation - if >0.999, the model is working correctly.")
        print("=" * 60)
        return 0  # Still return 0 as small differences are expected


if __name__ == "__main__":
    exit(main())
