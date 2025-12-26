"""
Prosodic Sarcasm Detection - Inference Utility

Standalone script for testing prosodic sarcasm detection on audio files.
Useful for debugging and qualitative evaluation.

Usage:
    python inference.py path/to/audio.wav
    python inference.py path/to/audio.mp3 --verbose
"""

import argparse
import pickle
import numpy as np
import torch
import torchaudio
from pathlib import Path
from transformers import Wav2Vec2Processor, Wav2Vec2Model

# Configuration
WAV2VEC_MODEL_NAME = "facebook/wav2vec2-base-960h"
TARGET_SAMPLE_RATE = 16000

# Paths
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent.parent / "backend"
MODEL_PATH = BACKEND_DIR / "prosodic_model.pkl"


def load_models(verbose: bool = False):
    """Load Wav2Vec2 encoder and classifier."""
    if verbose:
        print(f"Loading Wav2Vec2 model: {WAV2VEC_MODEL_NAME}")

    processor = Wav2Vec2Processor.from_pretrained(WAV2VEC_MODEL_NAME)
    model = Wav2Vec2Model.from_pretrained(WAV2VEC_MODEL_NAME)
    model.eval()

    if verbose:
        print(f"Loading classifier from: {MODEL_PATH}")

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Classifier not found at {MODEL_PATH}. Run train_prosodic.py first."
        )

    with open(MODEL_PATH, "rb") as f:
        classifier = pickle.load(f)

    return processor, model, classifier


def load_audio(audio_path: str, verbose: bool = False) -> tuple:
    """Load and preprocess audio file."""
    if verbose:
        print(f"Loading audio: {audio_path}")

    # Load audio
    waveform, sr = torchaudio.load(audio_path)

    if verbose:
        print(
            f"  Original: {waveform.shape[1]} samples at {sr}Hz ({waveform.shape[1] / sr:.2f}s)"
        )

    # Convert to mono
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)

    # Resample to 16kHz
    if sr != TARGET_SAMPLE_RATE:
        resampler = torchaudio.transforms.Resample(sr, TARGET_SAMPLE_RATE)
        waveform = resampler(waveform)
        if verbose:
            print(f"  Resampled to {TARGET_SAMPLE_RATE}Hz")

    # Squeeze and normalize
    waveform = waveform.squeeze(0)
    waveform = (waveform - waveform.mean()) / (waveform.std() + 1e-9)

    if verbose:
        print(
            f"  Processed: {len(waveform)} samples ({len(waveform) / TARGET_SAMPLE_RATE:.2f}s)"
        )

    return waveform


def extract_embedding(
    waveform: torch.Tensor, processor, model, verbose: bool = False
) -> np.ndarray:
    """Extract Wav2Vec2 embedding."""
    inputs = processor(
        waveform.numpy(),
        sampling_rate=TARGET_SAMPLE_RATE,
        return_tensors="pt",
        padding=True,
    )

    with torch.no_grad():
        outputs = model(inputs.input_values)
        embedding = outputs.last_hidden_state.mean(dim=1).squeeze(0).numpy()

    if verbose:
        print(f"  Embedding shape: {embedding.shape}")

    return embedding


def predict(audio_path: str, verbose: bool = False) -> float:
    """
    Predict sarcasm score for an audio file.

    Args:
        audio_path: Path to audio file
        verbose: Print debug information

    Returns:
        Sarcasm score in [0, 1]
    """
    # Load models
    processor, model, classifier = load_models(verbose)

    # Load and preprocess audio
    waveform = load_audio(audio_path, verbose)

    # Extract embedding
    embedding = extract_embedding(waveform, processor, model, verbose)

    # Predict
    embedding_2d = embedding.reshape(1, -1)
    score = classifier.predict_proba(embedding_2d)[0, 1]

    return score


def main():
    parser = argparse.ArgumentParser(
        description="Predict sarcasm score for audio files"
    )
    parser.add_argument(
        "audio_files", nargs="+", help="Path(s) to audio file(s) to analyze"
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Print detailed processing information",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Prosodic Sarcasm Detection")
    print("=" * 60)

    # Load models once
    if args.verbose:
        print("\nLoading models...")
    processor, model, classifier = load_models(args.verbose)

    # Process each audio file
    print("\nResults:")
    print("-" * 60)

    for audio_path in args.audio_files:
        path = Path(audio_path)

        if not path.exists():
            print(f"  ✗ File not found: {audio_path}")
            continue

        try:
            waveform = load_audio(audio_path, args.verbose)
            embedding = extract_embedding(waveform, processor, model, args.verbose)
            score = classifier.predict_proba(embedding.reshape(1, -1))[0, 1]

            # Interpret score
            if score >= 0.7:
                interpretation = "Likely Sarcastic"
            elif score >= 0.5:
                interpretation = "Possibly Sarcastic"
            elif score >= 0.3:
                interpretation = "Possibly Not Sarcastic"
            else:
                interpretation = "Likely Not Sarcastic"

            print(f"  [{score:.3f}] {path.name} - {interpretation}")

        except Exception as e:
            print(f"  ✗ Error processing {audio_path}: {e}")

    print("-" * 60)


if __name__ == "__main__":
    main()
