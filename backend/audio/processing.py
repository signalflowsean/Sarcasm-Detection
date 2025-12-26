"""
Audio processing utilities for prosodic sarcasm detection.
Handles decoding, preprocessing, and embedding extraction using ONNX Runtime.

Security: Internal error details (FFmpeg output, file paths) are logged
but not exposed to users. User-facing errors are sanitized.
"""

import io
import logging
import os
import subprocess
import tempfile

import numpy as np

from config import FFMPEG_TIMEOUT, TARGET_SAMPLE_RATE
from errors import AudioDecodingError, AudioValidationError, ModelUnavailableError, UserError

logger = logging.getLogger(__name__)

# Lazy imports for optional dependencies
_sf = None
_scipy_signal = None


def _ensure_imports():
    """Lazy import audio processing dependencies."""
    global _sf, _scipy_signal

    if _sf is None:
        import soundfile as sf
        from scipy import signal

        _sf = sf
        _scipy_signal = signal


def _validate_path_in_directory(file_path: str, base_dir: str) -> str:
    """
    Validate that a file path is within the specified base directory.
    Prevents path traversal attacks by ensuring resolved paths are contained.

    Args:
        file_path: Path to validate
        base_dir: Base directory that file_path must be within

    Returns:
        Resolved absolute path if valid

    Raises:
        ValueError: If path is outside base directory or contains invalid characters
    """
    # Resolve both paths to absolute paths (resolves symlinks)
    resolved_path = os.path.realpath(file_path)
    resolved_base = os.path.realpath(base_dir)

    # Ensure resolved path starts with resolved base directory
    # Use os.path.commonpath to handle edge cases correctly
    try:
        common_path = os.path.commonpath([resolved_path, resolved_base])
        if common_path != resolved_base:
            logger.error(
                f'[SECURITY] Path traversal attempt detected: {file_path} resolves to {resolved_path} '
                f'which is outside base directory {resolved_base}'
            )
            raise ValueError('Invalid file path: path traversal detected')
    except ValueError as e:
        # os.path.commonpath raises ValueError if paths are on different drives (Windows)
        # In this case, check if resolved_path starts with resolved_base
        if not resolved_path.startswith(resolved_base + os.sep) and resolved_path != resolved_base:
            logger.error(
                f'[SECURITY] Path traversal attempt detected: {file_path} resolves to {resolved_path} '
                f'which is outside base directory {resolved_base}'
            )
            # Chain exception to preserve context for debugging while sanitizing user message
            raise ValueError('Invalid file path: path traversal detected') from e

    # Additional check: warn if path contains path traversal sequences
    # (This shouldn't happen with os.path.join, but provides defense in depth)
    # Check for actual path traversal patterns: /../, ../ at start, or ..\ (Windows)
    if (
        '/../' in file_path
        or file_path.startswith('../')
        or file_path.startswith('..\\')
        or '\\..\\' in file_path
    ):
        logger.warning(f'[SECURITY] Suspicious path contains path traversal pattern: {file_path}')

    return resolved_path


def _decode_with_ffmpeg(audio_bytes: bytes) -> tuple:
    """
    Decode audio using FFmpeg as a fallback for formats like WebM/Opus.
    Converts to WAV format which can then be read by soundfile.

    Security: All file paths are validated to prevent path traversal attacks.
    Command arguments are passed as a list (not shell string) to prevent injection.

    Args:
        audio_bytes: Raw audio file bytes.

    Returns:
        tuple: (waveform as numpy array, sample_rate)

    Raises:
        ValueError: If FFmpeg conversion fails or security validation fails.
    """
    _ensure_imports()

    with tempfile.TemporaryDirectory() as tmpdir:
        # Use simple, predictable filenames (no user input)
        input_filename = 'input_audio'
        output_filename = 'output.wav'

        # Construct paths using os.path.join (safe for known components)
        input_path = os.path.join(tmpdir, input_filename)
        output_path = os.path.join(tmpdir, output_filename)

        # SECURITY: Validate paths are within temp directory (prevents path traversal)
        try:
            validated_input_path = _validate_path_in_directory(input_path, tmpdir)
            validated_output_path = _validate_path_in_directory(output_path, tmpdir)
        except ValueError as e:
            logger.error(f'[SECURITY] Path validation failed: {e}')
            raise AudioDecodingError(f'[SECURITY] Path validation failed: {e}') from e

        # Write input bytes to temp file
        try:
            with open(validated_input_path, 'wb') as f:
                f.write(audio_bytes)
        except OSError as e:
            logger.error(f'[AUDIO] Failed to write temp file: {e}')
            raise AudioDecodingError(f'[AUDIO] Failed to write temp file: {e}') from e

        # SECURITY: Build command as list (prevents shell injection)
        # All arguments are either literals or validated integers
        # File paths are validated above to be within temp directory
        cmd = [
            'ffmpeg',
            '-i',
            validated_input_path,  # Validated path
            '-ar',
            str(TARGET_SAMPLE_RATE),  # Integer literal converted to string
            '-ac',
            '1',  # Literal string
            '-f',
            'wav',  # Literal string
            '-y',  # Overwrite output (prevents prompt)
            '-nostdin',  # Don't read from stdin (security: prevents interactive input)
            validated_output_path,  # Validated path
        ]

        try:
            # SECURITY: Use list form (no shell=True), capture output, set timeout
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=FFMPEG_TIMEOUT,
                check=False,  # We check returncode manually
            )

            if result.returncode != 0:
                # Log detailed FFmpeg error internally (may contain paths, codec info)
                error_msg = result.stderr.decode('utf-8', errors='ignore')
                logger.error(f'[AUDIO] FFmpeg conversion failed: {error_msg[:500]}')
                # Return sanitized error to user
                raise AudioDecodingError(f'[AUDIO] FFmpeg conversion failed: {error_msg[:500]}')

            # SECURITY: Validate output file exists and is readable before reading
            if not os.path.exists(validated_output_path):
                logger.error(f'[AUDIO] FFmpeg output file not found: {validated_output_path}')
                raise AudioDecodingError(
                    f'[AUDIO] FFmpeg output file not found: {validated_output_path}'
                )

            # Read the converted WAV file
            waveform, sr = _sf.read(validated_output_path)
            logger.debug(f'FFmpeg successfully decoded audio: {len(waveform)} samples at {sr}Hz')
            return waveform, sr

        except subprocess.TimeoutExpired as e:
            logger.error(f'[AUDIO] FFmpeg conversion timed out after {FFMPEG_TIMEOUT} seconds')
            # Chain exception to preserve context for debugging while sanitizing user message
            raise AudioDecodingError(
                f'[AUDIO] FFmpeg conversion timed out after {FFMPEG_TIMEOUT} seconds'
            ) from e
        except FileNotFoundError as e:
            logger.error('[AUDIO] FFmpeg binary not found in PATH')
            # Chain exception to preserve context for debugging while sanitizing user message
            raise AudioDecodingError('[AUDIO] FFmpeg binary not found in PATH') from e
        except (ValueError, AudioDecodingError):
            # Re-raise ValueError and AudioDecodingError (already sanitized)
            raise
        except Exception as e:
            # Catch any other unexpected errors
            logger.error(
                f'[AUDIO] Unexpected error during FFmpeg conversion: {type(e).__name__}: {e}'
            )
            # Chain exception to preserve context for debugging while sanitizing user message
            raise AudioDecodingError(
                f'[AUDIO] Unexpected error during FFmpeg conversion: {type(e).__name__}: {e}'
            ) from e


def decode_audio(audio_bytes: bytes) -> tuple:
    """
    Decode audio bytes to waveform.
    Tries soundfile first, then falls back to FFmpeg for WebM/Opus and other formats.

    Args:
        audio_bytes: Raw audio file bytes.

    Returns:
        tuple: (waveform as numpy array, sample_rate)

    Raises:
        AudioDecodingError: If audio cannot be decoded.
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
    except (ValueError, AudioDecodingError):
        # Re-raise ValueError and AudioDecodingError (already sanitized in _decode_with_ffmpeg)
        raise
    except Exception as e:
        # Log internal error details, return sanitized message
        logger.error(f'[AUDIO] Decode failed with unexpected error: {type(e).__name__}: {e}')
        # Chain exception to preserve context for debugging while sanitizing user message
        raise AudioDecodingError(
            f'[AUDIO] Decode failed with unexpected error: {type(e).__name__}: {e}'
        ) from e


def preprocess_audio(waveform: np.ndarray, sr: int) -> np.ndarray:
    """
    Preprocess audio for Wav2Vec2 model.
    - Convert to mono
    - Resample to 16kHz using scipy (replaces torchaudio)
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

    # Resample to 16kHz if necessary using scipy
    # SECURITY: Validate sample rate to prevent division by zero
    if sr <= 0:
        logger.error(f'[AUDIO] Invalid sample rate: {sr}')
        raise AudioValidationError(
            UserError.AUDIO_PROCESSING_FAILED, f'[AUDIO] Invalid sample rate: {sr}'
        )

    if sr != TARGET_SAMPLE_RATE:
        # Calculate resampling ratio
        num_samples = int(len(waveform) * TARGET_SAMPLE_RATE / sr)
        waveform = _scipy_signal.resample(waveform, num_samples)

    # Normalize (zero mean, unit variance)
    # SECURITY: Validate waveform has sufficient variance to prevent division issues
    waveform_mean = waveform.mean()
    waveform_std = waveform.std()

    # Check for constant signal (all zeros or constant value)
    if waveform_std < 1e-9:
        logger.warning(
            f'[AUDIO] Waveform has near-zero variance (std={waveform_std:.2e}), '
            'skipping normalization to prevent division issues'
        )
        # Return zero-mean waveform without normalization
        waveform = waveform - waveform_mean
    else:
        waveform = (waveform - waveform_mean) / waveform_std

    return waveform.astype(np.float32)


def extract_embedding(waveform: np.ndarray) -> np.ndarray:
    """
    Extract Wav2Vec2 embedding from preprocessed audio using ONNX Runtime.

    Args:
        waveform: Preprocessed audio waveform (1D numpy array, 16kHz, normalized).

    Returns:
        Embedding as numpy array of shape (768,).

    Raises:
        ModelUnavailableError: If ONNX model is not loaded or inference fails.
        AudioValidationError: If input waveform is invalid.
    """
    from models.loader import get_onnx_session, load_onnx_model

    # Ensure model is loaded
    # CRITICAL: Check return value of load_onnx_model() to handle failures
    if not load_onnx_model():
        logger.error('[AUDIO] Failed to load ONNX model - cannot extract embedding')
        raise ModelUnavailableError('[AUDIO] Failed to load ONNX model - cannot extract embedding')

    session = get_onnx_session()

    # CRITICAL: Double-check session is not None after loading
    if session is None:
        logger.error(
            '[AUDIO] ONNX model reported loaded but session is None - cannot extract embedding'
        )
        raise ModelUnavailableError(
            '[AUDIO] ONNX model reported loaded but session is None - cannot extract embedding'
        )

    # SECURITY: Validate input waveform
    if not isinstance(waveform, np.ndarray):
        logger.error(f'[AUDIO] Invalid waveform type: {type(waveform)}, expected numpy.ndarray')
        raise AudioValidationError(
            UserError.AUDIO_PROCESSING_FAILED,
            f'[AUDIO] Invalid waveform type: {type(waveform)}, expected numpy.ndarray',
        )

    if waveform.size == 0:
        logger.error('[AUDIO] Empty waveform provided')
        raise AudioValidationError(UserError.AUDIO_EMPTY, '[AUDIO] Empty waveform provided')

    # Prepare input (add batch dimension)
    input_values = waveform.reshape(1, -1).astype(np.float32)

    # Run ONNX inference with error handling
    try:
        outputs = session.run(['last_hidden_state'], {'input_values': input_values})
    except Exception as e:
        # ONNX Runtime can raise various exceptions (InvalidArgument, RuntimeException, etc.)
        logger.error(f'[AUDIO] ONNX inference failed: {type(e).__name__}: {e}')
        raise ModelUnavailableError(
            f'[AUDIO] ONNX inference failed: {type(e).__name__}: {e}'
        ) from e

    # SECURITY: Validate output structure before accessing
    if not outputs or len(outputs) == 0:
        logger.error('[AUDIO] ONNX model returned empty output')
        raise ModelUnavailableError('[AUDIO] ONNX model returned empty output')

    hidden_states = outputs[0]

    # SECURITY: Validate output shape before processing
    if not isinstance(hidden_states, np.ndarray):
        logger.error(f'[AUDIO] ONNX output is not a numpy array: {type(hidden_states)}')
        raise ModelUnavailableError(
            f'[AUDIO] ONNX output is not a numpy array: {type(hidden_states)}'
        )

    if hidden_states.ndim < 2:
        logger.error(
            f'[AUDIO] Unexpected ONNX output shape: {hidden_states.shape}, expected at least 2D'
        )
        raise ModelUnavailableError(
            f'[AUDIO] Unexpected ONNX output shape: {hidden_states.shape}, expected at least 2D'
        )

    # Mean pool over time dimension
    # Expected shape: (batch_size, seq_len, 768) -> (batch_size, 768) -> (768,)
    try:
        embedding = hidden_states.mean(axis=1).squeeze(0)  # Shape: (768,)
    except Exception as e:
        logger.error(f'[AUDIO] Failed to process ONNX output: {type(e).__name__}: {e}')
        raise ModelUnavailableError(
            f'[AUDIO] Failed to process ONNX output: {type(e).__name__}: {e}'
        ) from e

    # SECURITY: Validate final embedding shape
    if embedding.shape != (768,):
        logger.error(f'[AUDIO] Unexpected embedding shape: {embedding.shape}, expected (768,)')
        raise ModelUnavailableError(
            f'[AUDIO] Unexpected embedding shape: {embedding.shape}, expected (768,)'
        )

    return embedding
