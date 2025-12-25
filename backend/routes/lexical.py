"""
Lexical (text-based) sarcasm detection endpoint.

Security: Error messages returned to users are sanitized.
"""

import logging
import time
import uuid

from flask import Blueprint, jsonify, request

from config import API_DELAY_SECONDS, MAX_TEXT_LENGTH, RATE_LIMIT_LEXICAL
from errors import UserError
from extensions import limiter
from models import lexical_predict
from models.loader import load_lexical_model
from text import sanitize_text

bp = Blueprint('lexical', __name__)
logger = logging.getLogger(__name__)


@bp.route('/api/lexical', methods=['POST'])
@limiter.limit(RATE_LIMIT_LEXICAL)
def lexical_detection():
    """
    Lexical sarcasm detection endpoint.
    Accepts JSON with 'text' field, returns sarcasm score 0-1.

    Max text length: 10,000 characters

    Request body: { "text": "string" }
    Response: { "id": "uuid", "value": 0.0-1.0, "reliable": true/false }

    The 'reliable' field indicates whether the prediction came from the actual
    ML model (true) or is a fallback/random value due to model unavailability (false).
    """
    data = request.get_json()

    if not data or 'text' not in data:
        return jsonify({'error': UserError.TEXT_MISSING}), 400

    text = data['text']
    if not isinstance(text, str) or not text.strip():
        return jsonify({'error': UserError.TEXT_INVALID}), 400

    # Sanitize text input: normalize Unicode, remove control characters
    # This prevents issues with malformed input while preserving legitimate text
    original_length = len(text)
    text = sanitize_text(text)
    sanitized_length = len(text)

    if original_length != sanitized_length:
        logger.debug(
            f'[LEXICAL] Text sanitized: {original_length} -> {sanitized_length} chars '
            f'(removed {original_length - sanitized_length} problematic character(s))'
        )

    # Re-check if text is empty after sanitization
    if not text.strip():
        return jsonify({'error': UserError.TEXT_INVALID}), 400

    if len(text) > MAX_TEXT_LENGTH:
        # Log actual length internally
        logger.warning(f'[LEXICAL] Text too long: {len(text)} chars (max: {MAX_TEXT_LENGTH})')
        return jsonify({'error': UserError.TEXT_TOO_LONG}), 400

    # Ensure model is loaded before prediction
    # This prevents errors if model failed to load at startup
    if not load_lexical_model():
        logger.warning('[LEXICAL] Model not available, using fallback score')
        return jsonify({'id': str(uuid.uuid4()), 'value': 0.5, 'reliable': False})

    # Artificial delay to showcase loading animations
    if API_DELAY_SECONDS > 0:
        time.sleep(API_DELAY_SECONDS)

    # Returns (score, is_real_prediction)
    try:
        score, is_real = lexical_predict(text)
    except Exception as e:
        # Unexpected error during prediction - log internally, return fallback
        logger.error(f'[LEXICAL ERROR] Unexpected error during prediction: {type(e).__name__}: {e}')
        # Return fallback score (0.5 = uncertain) instead of crashing
        score = 0.5
        is_real = False

    return jsonify({'id': str(uuid.uuid4()), 'value': score, 'reliable': is_real})
