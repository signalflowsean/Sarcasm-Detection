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
from errors import UserError
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

    # Validate audio file (type, size, and content)
    # Pass request object to enable Content-Length header check for performance
    is_valid, error_message = validate_audio_file(audio_file, request=request)
    if not is_valid:
        return jsonify({'error': error_message}), 400

    # Read the audio data
    audio_bytes = audio_file.read()

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

    except ValueError as e:
        # Expected error: Audio decode/processing failures (decode_audio raises ValueError)
        # These are user input issues or format problems - return fallback score
        error_msg = str(e)
        logger.warning(
            f'[PROSODIC] Audio processing failed (expected error): {type(e).__name__}: {error_msg}'
        )
        # Check if it's a sanitized user error message
        if error_msg in (
            UserError.AUDIO_DECODE_FAILED,
            UserError.AUDIO_PROCESSING_FAILED,
            UserError.MODEL_UNAVAILABLE,
        ):
            # User-friendly error already sanitized
            logger.info('[PROSODIC FALLBACK] Using fallback score due to audio processing error')
        else:
            # Unexpected ValueError - log but still use fallback
            logger.error(f'[PROSODIC] Unexpected ValueError: {error_msg}')
        score = 0.5
        is_real = False

    except RuntimeError as e:
        # Expected error: Model unavailable (extract_embedding raises RuntimeError)
        # This is an expected service degradation - return fallback score
        error_msg = str(e)
        if UserError.MODEL_UNAVAILABLE in error_msg:
            logger.warning('[PROSODIC] Model unavailable (expected): Using fallback score')
            score = 0.5
            is_real = False
        else:
            # Unexpected RuntimeError - re-raise to be handled by Flask error handler
            logger.error(f'[PROSODIC] Unexpected RuntimeError: {type(e).__name__}: {error_msg}')
            raise

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
