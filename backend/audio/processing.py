"""
Audio processing utilities for prosodic sarcasm detection.
Handles decoding, preprocessing, and embedding extraction.

Security: Internal error details (FFmpeg output, file paths) are logged
but not exposed to users. User-facing errors are sanitized.
"""

import io
import logging
import os
import subprocess
import tempfile

import numpy as np

from config import TARGET_SAMPLE_RATE
from errors import UserError

logger = logging.getLogger(__name__)

# Lazy imports for optional dependencies
_torch = None
_torchaudio = None
_sf = None


def _ensure_imports():
    """Lazy import audio processing dependencies."""
    global _torch, _torchaudio, _sf

    if _torch is None:
        import soundfile as sf
        import torch
        import torchaudio

        _torch = torch
        _torchaudio = torchaudio
        _sf = sf


def _decode_with_ffmpeg(audio_bytes: bytes) -> tuple:
    """
    Decode audio using FFmpeg as a fallback for formats like WebM/Opus.
    Converts to WAV format which can then be read by soundfile.

    Args:
        audio_bytes: Raw audio file bytes.

    Returns:
        tuple: (waveform as numpy array, sample_rate)

    Raises:
        ValueError: If FFmpeg conversion fails.
    """
    _ensure_imports()

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, 'input_audio')
        output_path = os.path.join(tmpdir, 'output.wav')

        # Write input bytes to temp file
        with open(input_path, 'wb') as f:
            f.write(audio_bytes)

        # Use FFmpeg to convert to WAV (16kHz mono for Wav2Vec2)
        cmd = [
            'ffmpeg',
            '-i',
            input_path,
            '-ar',
            str(TARGET_SAMPLE_RATE),  # 16kHz sample rate
            '-ac',
            '1',  # Mono
            '-f',
            'wav',  # Output format
            '-y',  # Overwrite output
            output_path,
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=30,  # 30 second timeout
            )

            if result.returncode != 0:
                # Log detailed FFmpeg error internally (may contain paths, codec info)
                error_msg = result.stderr.decode('utf-8', errors='ignore')
                logger.error(f'[AUDIO] FFmpeg conversion failed: {error_msg[:500]}')
                # Return sanitized error to user
                raise ValueError(UserError.AUDIO_DECODE_FAILED)

            # Read the converted WAV file
            waveform, sr = _sf.read(output_path)
            logger.debug(f'FFmpeg successfully decoded audio: {len(waveform)} samples at {sr}Hz')
            return waveform, sr

        except subprocess.TimeoutExpired:
            logger.error('[AUDIO] FFmpeg conversion timed out after 30 seconds')
            raise ValueError(UserError.AUDIO_DECODE_FAILED)
        except FileNotFoundError:
            logger.error('[AUDIO] FFmpeg binary not found in PATH')
            raise ValueError(UserError.AUDIO_DECODE_FAILED)


def decode_audio(audio_bytes: bytes) -> tuple:
    """
    Decode audio bytes to waveform.
    Tries soundfile first, then falls back to FFmpeg for WebM/Opus and other formats.

    Args:
        audio_bytes: Raw audio file bytes.

    Returns:
        tuple: (waveform as numpy array, sample_rate)

    Raises:
        ValueError: If audio cannot be decoded.
    """
    _ensure_imports()

    audio_buffer = io.BytesIO(audio_bytes)

    # Try soundfile first (supports WAV, FLAC, OGG)
    try:
        waveform, sr = _sf.read(audio_buffer)
        logger.debug(f'soundfile decoded audio: {len(waveform)} samples at {sr}Hz')
        return waveform, sr
    except Exception as e:
        logger.debug(f'soundfile failed: {e}, trying FFmpeg')

    # Fallback to FFmpeg for formats soundfile doesn't handle (WebM, MP3, M4A, etc.)
    try:
        return _decode_with_ffmpeg(audio_bytes)
    except ValueError:
        # Re-raise ValueError (already sanitized in _decode_with_ffmpeg)
        raise
    except Exception as e:
        # Log internal error details, return sanitized message
        logger.error(f'[AUDIO] Decode failed with unexpected error: {type(e).__name__}: {e}')
        raise ValueError(UserError.AUDIO_DECODE_FAILED)


def preprocess_audio(waveform: np.ndarray, sr: int) -> np.ndarray:
    """
    Preprocess audio for Wav2Vec2 model.
    - Convert to mono
    - Resample to 16kHz
    - Normalize

    Args:
        waveform: Audio waveform as numpy array.
        sr: Sample rate.

    Returns:
        Preprocessed waveform as 1D numpy array.
    """
    _ensure_imports()

    # Convert to mono if stereo
    if waveform.ndim == 2:
        waveform = waveform.mean(axis=1)

    # Resample to 16kHz if necessary
    if sr != TARGET_SAMPLE_RATE:
        waveform_tensor = _torch.tensor(waveform).unsqueeze(0).float()
        resampler = _torchaudio.transforms.Resample(sr, TARGET_SAMPLE_RATE)
        waveform_tensor = resampler(waveform_tensor)
        waveform = waveform_tensor.squeeze(0).numpy()

    # Normalize (zero mean, unit variance)
    waveform = (waveform - waveform.mean()) / (waveform.std() + 1e-9)

    return waveform


def extract_embedding(waveform: np.ndarray) -> np.ndarray:
    """
    Extract Wav2Vec2 embedding from preprocessed audio.

    Args:
        waveform: Preprocessed audio waveform (1D numpy array, 16kHz, normalized).

    Returns:
        Embedding as numpy array of shape (768,).

    Raises:
        RuntimeError: If Wav2Vec2 models are not loaded.
    """
    _ensure_imports()

    from models.loader import get_wav2vec_components, load_prosodic_models

    # Ensure models are loaded
    load_prosodic_models()
    processor, model = get_wav2vec_components()

    if processor is None or model is None:
        logger.error('[AUDIO] Wav2Vec2 models not loaded - cannot extract embedding')
        raise RuntimeError(UserError.MODEL_UNAVAILABLE)

    # Prepare input for Wav2Vec2
    inputs = processor(
        waveform, sampling_rate=TARGET_SAMPLE_RATE, return_tensors='pt', padding=True
    )

    # Extract embedding
    with _torch.no_grad():
        outputs = model(inputs.input_values)
        # Mean pool over time dimension
        embedding = outputs.last_hidden_state.mean(dim=1).squeeze(0).numpy()

    return embedding
