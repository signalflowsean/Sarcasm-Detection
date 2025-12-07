"""
Audio processing utilities for prosodic sarcasm detection.
Handles decoding, preprocessing, and embedding extraction.
"""

import io
import logging
import numpy as np

from config import TARGET_SAMPLE_RATE

logger = logging.getLogger(__name__)

# Lazy imports for optional dependencies
_torch = None
_torchaudio = None
_sf = None


def _ensure_imports():
    """Lazy import audio processing dependencies."""
    global _torch, _torchaudio, _sf
    
    if _torch is None:
        import torch
        import torchaudio
        import soundfile as sf
        _torch = torch
        _torchaudio = torchaudio
        _sf = sf


def decode_audio(audio_bytes: bytes) -> tuple:
    """
    Decode audio bytes to waveform using soundfile.
    Handles multiple formats (WAV, FLAC, OGG, etc.)
    
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
        return waveform, sr
    except Exception as e:
        logger.debug(f"soundfile failed: {e}, trying torchaudio")
    
    # Fallback to torchaudio for formats soundfile doesn't handle (MP3, M4A, etc.)
    audio_buffer.seek(0)
    try:
        waveform, sr = _torchaudio.load(audio_buffer)
        # torchaudio returns (channels, samples), convert to (samples,) or (samples, channels)
        waveform = waveform.numpy()
        if waveform.ndim == 2:
            waveform = waveform.T  # (samples, channels)
        return waveform, sr
    except Exception as e:
        logger.error(f"torchaudio also failed: {e}")
        raise ValueError(f"Could not decode audio: {e}")


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
        raise RuntimeError("Wav2Vec2 models not available")
    
    # Prepare input for Wav2Vec2
    inputs = processor(
        waveform,
        sampling_rate=TARGET_SAMPLE_RATE,
        return_tensors="pt",
        padding=True
    )
    
    # Extract embedding
    with _torch.no_grad():
        outputs = model(inputs.input_values)
        # Mean pool over time dimension
        embedding = outputs.last_hidden_state.mean(dim=1).squeeze(0).numpy()
    
    return embedding

