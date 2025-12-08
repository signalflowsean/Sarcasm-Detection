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
    is_valid, error_message = validate_audio_file(audio_file)
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

    except Exception as e:
        # Log detailed error internally (may contain sensitive info)
        logger.error(f'[PROSODIC ERROR] Audio processing failed: {type(e).__name__}: {e}')
        # Fallback to neutral score on error (0.5 = uncertain)
        score = 0.5
        is_real = False
        logger.warning('[PROSODIC FALLBACK] Using fallback score due to error')

    return jsonify({'id': str(uuid.uuid4()), 'value': score, 'reliable': is_real})
