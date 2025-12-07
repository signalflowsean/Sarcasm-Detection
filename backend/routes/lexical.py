"""
Lexical (text-based) sarcasm detection endpoint.
"""

import time
import uuid

from flask import Blueprint, request, jsonify

from config import MAX_TEXT_LENGTH, API_DELAY_SECONDS
from models import lexical_predict

bp = Blueprint('lexical', __name__)


@bp.route('/api/lexical', methods=['POST'])
def lexical_detection():
    """
    Lexical sarcasm detection endpoint.
    Accepts JSON with 'text' field, returns sarcasm score 0-1.
    
    Max text length: 10,000 characters
    
    Request body: { "text": "string" }
    Response: { "id": "uuid", "value": 0.0-1.0 }
    """
    data = request.get_json()
    
    if not data or 'text' not in data:
        return jsonify({'error': 'Missing required field: text'}), 400
    
    text = data['text']
    if not isinstance(text, str) or not text.strip():
        return jsonify({'error': 'Text must be a non-empty string'}), 400
    
    if len(text) > MAX_TEXT_LENGTH:
        return jsonify({'error': f'Text exceeds maximum length of {MAX_TEXT_LENGTH:,} characters'}), 400
    
    # Artificial delay to showcase loading animations
    if API_DELAY_SECONDS > 0:
        time.sleep(API_DELAY_SECONDS)
    
    score = lexical_predict(text)
    
    return jsonify({
        'id': str(uuid.uuid4()),
        'value': score
    })

