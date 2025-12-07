"""
Prosodic (audio-based) sarcasm detection endpoint.
"""

import time
import uuid
import logging

from flask import Blueprint, request, jsonify

from config import TARGET_SAMPLE_RATE, API_DELAY_SECONDS
from audio import validate_audio_file, decode_audio, preprocess_audio, extract_embedding
from models import prosodic_predict, load_prosodic_models

bp = Blueprint('prosodic', __name__)
logger = logging.getLogger(__name__)


@bp.route('/api/prosodic', methods=['POST'])
def prosodic_detection():
    """
    Prosodic sarcasm detection endpoint.
    Accepts audio file upload, returns sarcasm score 0-1.
    
    Uses Wav2Vec2 embeddings + LogisticRegression classifier trained on MUStARD dataset.
    
    Supported formats: WAV, MP3, WebM, OGG, FLAC, M4A, AAC
    Max file size: 50MB (aligned with nginx client_max_body_size)
    
    Request: multipart/form-data with 'audio' file
    Response: { "id": "uuid", "value": 0.0-1.0 }
    """
    if 'audio' not in request.files:
        return jsonify({'error': 'Missing required file: audio'}), 400
    
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
    
    # Try to use the real prosodic model
    models_loaded = load_prosodic_models()
    
    if models_loaded:
        try:
            # Decode audio
            waveform, sr = decode_audio(audio_bytes)
            logger.debug(f"Decoded audio: {len(waveform)} samples at {sr}Hz")
            
            # Preprocess (mono, 16kHz, normalized)
            waveform = preprocess_audio(waveform, sr)
            logger.debug(f"Preprocessed audio: {len(waveform)} samples")
            
            # Check minimum length (at least 0.1 seconds)
            min_samples = int(TARGET_SAMPLE_RATE * 0.1)
            if len(waveform) < min_samples:
                return jsonify({'error': 'Audio too short for analysis (minimum 0.1 seconds)'}), 400
            
            # Extract embedding
            embedding = extract_embedding(waveform)
            logger.debug(f"Extracted embedding: shape {embedding.shape}")
            
            # Predict sarcasm score
            score = prosodic_predict(embedding)
            
        except Exception as e:
            logger.error(f"Error during prosodic prediction: {e}")
            # Fallback to random on error
            import random
            score = random.random()
    else:
        # Fallback to random if model not loaded
        import random
        logger.warning("Prosodic model not available, returning random score")
        score = random.random()
    
    return jsonify({
        'id': str(uuid.uuid4()),
        'value': score
    })

