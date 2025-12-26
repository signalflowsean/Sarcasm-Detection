"""
Prosodic (audio-based) sarcasm detection endpoint.

Security: Error messages returned to users are sanitized.
Detailed error information is logged internally for debugging.
"""

import logging
import time
import uuid

from flask import Blueprint, jsonify, request

from audio import decode_audio, extract_embedding, preprocess_audio, validate_audio_file
from config import API_DELAY_SECONDS, RATE_LIMIT_PROSODIC, TARGET_SAMPLE_RATE
from errors import AudioDecodingError, AudioValidationError, ModelUnavailableError, UserError
from extensions import limiter
from models import prosodic_predict

bp = Blueprint('prosodic', __name__)
logger = logging.getLogger(__name__)


@bp.route('/api/prosodic', methods=['POST'])
@limiter.limit(RATE_LIMIT_PROSODIC)
def prosodic_detection():
    """
    Prosodic sarcasm detection endpoint.
    Accepts audio file upload, returns sarcasm score 0-1.

    Uses Wav2Vec2 embeddings + LogisticRegression classifier trained on MUStARD dataset.

    Supported formats: WAV, MP3, WebM, OGG, FLAC, M4A, AAC
    Max file size: 50MB (aligned with nginx client_max_body_size)

    Request: multipart/form-data with 'audio' file
    Response: { "id": "uuid", "value": 0.0-1.0, "reliable": true/false }

    The 'reliable' field indicates whether the prediction came from the actual
    ML model (true) or is a fallback/random value due to model unavailability (false).
    """
    if 'audio' not in request.files:
        return jsonify({'error': UserError.AUDIO_MISSING}), 400

    audio_file = request.files['audio']

    # CRITICAL: Check if audio_file is None or empty (defense in depth)
    if not audio_file or not audio_file.filename:
        return jsonify({'error': UserError.AUDIO_MISSING}), 400

    # Validate audio file (type, size, and content)
    # Pass request object to enable Content-Length header check for performance
    is_valid, error_message = validate_audio_file(audio_file, request=request)
    if not is_valid:
        return jsonify({'error': error_message}), 400

    # SECURITY: Double-check file size immediately before reading into memory
    # This minimizes TOCTOU (time-of-check-time-of-use) window and prevents memory exhaustion attacks
    # if validation was bypassed or if file was modified between validation and read
    from config import MAX_AUDIO_SIZE_BYTES

    try:
        # Re-check file size immediately before read to minimize TOCTOU window
        audio_file.seek(0, 2)  # Seek to end
        file_size = audio_file.tell()
        audio_file.seek(0)  # Reset to beginning for read

        # Validate size limit immediately before reading
        if file_size > MAX_AUDIO_SIZE_BYTES:
            logger.warning(
                f'[PROSODIC SECURITY] File size exceeded limit after validation: {file_size} bytes '
                f'(max: {MAX_AUDIO_SIZE_BYTES})'
            )
            return jsonify({'error': UserError.AUDIO_TOO_LARGE}), 400

        # Read the audio data immediately after size check (minimizes TOCTOU window)
        # SECURITY: Read exactly the validated file size - no buffer to prevent reading more than validated
        # This prevents potential memory exhaustion if file was modified between validation and read
        audio_bytes = audio_file.read(file_size)

        # SECURITY: Verify we read at least as many bytes as expected.
        # If we read fewer bytes than the validated file size, the file may have been
        # truncated or modified between validation and read, or the file handle may be corrupt.
        if len(audio_bytes) < file_size:
            logger.error(
                f'[PROSODIC SECURITY] Read fewer bytes than expected: {len(audio_bytes)} < {file_size}'
            )
            return jsonify({'error': UserError.AUDIO_PROCESSING_FAILED}), 400

        # SECURITY: Verify file position matches expected after read
        current_pos = audio_file.tell()
        if current_pos != file_size:
            logger.warning(
                f'[PROSODIC] File position mismatch after read: expected {file_size}, got {current_pos}'
            )
            # If we read less than expected, this could indicate file was truncated
            # If we read more than expected, this is a security issue (handled above)
            if len(audio_bytes) < file_size:
                logger.warning(
                    f'[PROSODIC] Read fewer bytes than expected: {len(audio_bytes)} < {file_size}'
                )

    except OSError as e:
        logger.error(f'[PROSODIC ERROR] Failed to read audio file: {type(e).__name__}: {e}')
        return jsonify({'error': UserError.AUDIO_PROCESSING_FAILED}), 400
    except MemoryError as e:
        # CRITICAL: Handle memory exhaustion explicitly
        logger.error(f'[PROSODIC SECURITY] Memory exhaustion while reading audio file: {e}')
        return jsonify({'error': UserError.AUDIO_TOO_LARGE}), 400

    # SECURITY: Validate that audio data was actually read
    if not audio_bytes:
        logger.warning('[PROSODIC SECURITY] Audio file read returned empty bytes')
        return jsonify({'error': UserError.AUDIO_EMPTY}), 400

    # SECURITY: Validate audio_bytes is actually bytes (defense in depth)
    if not isinstance(audio_bytes, bytes):
        logger.error(
            f'[PROSODIC SECURITY] Audio file read returned non-bytes type: {type(audio_bytes)}'
        )
        return jsonify({'error': UserError.AUDIO_PROCESSING_FAILED}), 400

    # SECURITY: Verify read size matches expected file size exactly
    # This detects if file was modified between size check and read (TOCTOU issue)
    if len(audio_bytes) != file_size:
        logger.error(
            f'[PROSODIC SECURITY] Size mismatch: read {len(audio_bytes)} bytes, expected {file_size}'
        )
        # Fail if size doesn't match - this prevents processing files that were modified
        return jsonify({'error': UserError.AUDIO_PROCESSING_FAILED}), 400

    # Artificial delay to showcase loading animations
    if API_DELAY_SECONDS > 0:
        time.sleep(API_DELAY_SECONDS)

    # Process audio and get prediction
    try:
        # Decode audio
        waveform, sr = decode_audio(audio_bytes)
        logger.info(f'Decoded audio: {len(waveform)} samples at {sr}Hz')

        # Preprocess (mono, 16kHz, normalized)
        waveform = preprocess_audio(waveform, sr)
        logger.debug(f'Preprocessed audio: {len(waveform)} samples')

        # Check minimum length (at least 0.1 seconds)
        min_samples = int(TARGET_SAMPLE_RATE * 0.1)
        if len(waveform) < min_samples:
            logger.warning(
                f'[PROSODIC] Audio too short: {len(waveform)} samples (min: {min_samples})'
            )
            return jsonify({'error': UserError.AUDIO_TOO_SHORT}), 400

        # Extract embedding
        embedding = extract_embedding(waveform)
        logger.debug(f'Extracted embedding: shape {embedding.shape}')

        # Predict sarcasm score (returns score and whether it's a real prediction)
        score, is_real = prosodic_predict(embedding)

    except AudioDecodingError as e:
        # Expected error: Audio decode/processing failures
        # These are user input issues or format problems - return fallback score
        logger.warning(f'[PROSODIC] Audio decoding failed (expected error): {e.internal_message}')
        logger.info('[PROSODIC FALLBACK] Using fallback score due to audio decoding error')
        score = 0.5
        is_real = False

    except AudioValidationError as e:
        # Expected error: Audio validation failures (too short, empty, invalid format)
        # Return error to user - these are not recoverable with fallback
        logger.warning(f'[PROSODIC] Audio validation failed: {e.internal_message}')
        return jsonify({'error': e.user_message}), 400

    except ModelUnavailableError as e:
        # Expected error: Model unavailable or inference failure
        # This is an expected service degradation - return fallback score
        logger.warning(
            f'[PROSODIC] Model unavailable (expected): {e.internal_message}. Using fallback score'
        )
        score = 0.5
        is_real = False

    except Exception as e:
        # Unexpected error: Something went wrong that we didn't anticipate
        # Re-raise to be handled by Flask's error handler (500 error)
        # This ensures unexpected bugs are properly logged and don't silently fail
        logger.error(
            f'[PROSODIC ERROR] Unexpected error during audio processing: {type(e).__name__}: {e}'
        )
        # Re-raise to trigger Flask's 500 error handler
        raise

    return jsonify({'id': str(uuid.uuid4()), 'value': score, 'reliable': is_real})
