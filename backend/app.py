"""
Flask backend for Sarcasm Detection API.
Provides endpoints for lexical (text-based) and prosodic (audio-based) sarcasm detection.
"""

import os
import random
import time
import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Artificial delay in seconds to showcase loading animations (set to 0 in production)
API_DELAY_SECONDS = float(os.environ.get('API_DELAY_SECONDS', '1.2'))


@app.route('/api/lexical', methods=['POST'])
def lexical_detection():
    """
    Lexical sarcasm detection endpoint.
    Accepts JSON with 'text' field, returns sarcasm score 0-1.
    
    Request body: { "text": "string" }
    Response: { "id": "uuid", "value": 0.0-1.0 }
    """
    data = request.get_json()
    
    if not data or 'text' not in data:
        return jsonify({'error': 'Missing required field: text'}), 400
    
    text = data['text']
    if not isinstance(text, str) or not text.strip():
        return jsonify({'error': 'Text must be a non-empty string'}), 400
    
    # Artificial delay to showcase loading animations
    if API_DELAY_SECONDS > 0:
        time.sleep(API_DELAY_SECONDS)
    
    # TODO: Replace with actual ML model inference
    # For now, return random value to match mock behavior
    score = random.random()
    
    return jsonify({
        'id': str(uuid.uuid4()),
        'value': score
    })


@app.route('/api/prosodic', methods=['POST'])
def prosodic_detection():
    """
    Prosodic sarcasm detection endpoint.
    Accepts audio file upload, returns sarcasm score 0-1.
    
    Request: multipart/form-data with 'audio' file
    Response: { "id": "uuid", "value": 0.0-1.0 }
    """
    if 'audio' not in request.files:
        return jsonify({'error': 'Missing required file: audio'}), 400
    
    audio_file = request.files['audio']
    
    if not audio_file.filename:
        return jsonify({'error': 'No audio file provided'}), 400
    
    # Read the audio data (for future processing)
    # audio_data = audio_file.read()
    
    # Artificial delay to showcase loading animations
    if API_DELAY_SECONDS > 0:
        time.sleep(API_DELAY_SECONDS)
    
    # TODO: Replace with actual ML model inference
    # For now, return random value to match mock behavior
    score = random.random()
    
    return jsonify({
        'id': str(uuid.uuid4()),
        'value': score
    })


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint for container orchestration."""
    return jsonify({'status': 'healthy'})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

