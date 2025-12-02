"""
Flask backend for Sarcasm Detection API.
Provides endpoints for lexical (text-based) and prosodic (audio-based) sarcasm detection.
"""

import os
import random
import time
import uuid
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

# Environment configuration
FLASK_ENV = os.environ.get('FLASK_ENV', 'development')
IS_PRODUCTION = FLASK_ENV == 'production'

# Configure logging
logging.basicConfig(
    level=logging.INFO if IS_PRODUCTION else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# CORS configuration: restrict origins in production
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')
if CORS_ORIGINS == '*':
    CORS(app)  # Allow all origins (development)
else:
    CORS(app, origins=CORS_ORIGINS.split(','))  # Restrict to specified origins

# Artificial delay in seconds to showcase loading animations
# Defaults to 0 in production, 1.2 in development
API_DELAY_SECONDS = float(os.environ.get('API_DELAY_SECONDS', '0' if IS_PRODUCTION else '1.2'))

# Text input validation constants
MAX_TEXT_LENGTH = 10000  # Maximum characters for lexical analysis

# Audio file validation constants (aligned with nginx client_max_body_size of 50M)
MAX_AUDIO_SIZE_MB = 50
MAX_AUDIO_SIZE_BYTES = MAX_AUDIO_SIZE_MB * 1024 * 1024

# Allowed audio MIME types and their corresponding extensions
ALLOWED_AUDIO_TYPES = {
    'audio/wav': ['.wav'],
    'audio/x-wav': ['.wav'],
    'audio/wave': ['.wav'],
    'audio/mpeg': ['.mp3'],
    'audio/mp3': ['.mp3'],
    'audio/webm': ['.webm'],
    'audio/ogg': ['.ogg', '.oga'],
    'audio/flac': ['.flac'],
    'audio/x-flac': ['.flac'],
    'audio/mp4': ['.m4a', '.mp4'],
    'audio/x-m4a': ['.m4a'],
    'audio/aac': ['.aac'],
}

ALLOWED_EXTENSIONS = {'.wav', '.mp3', '.webm', '.ogg', '.oga', '.flac', '.m4a', '.mp4', '.aac'}

# Audio file magic bytes for content validation
# Format: (offset, magic_bytes)
AUDIO_MAGIC_BYTES = {
    'wav': (0, b'RIFF'),          # RIFF header (followed by WAVE at offset 8)
    'mp3_id3': (0, b'ID3'),       # MP3 with ID3 tag
    'mp3_sync': (0, b'\xff\xfb'), # MP3 frame sync
    'mp3_sync2': (0, b'\xff\xfa'),
    'mp3_sync3': (0, b'\xff\xf3'),
    'mp3_sync4': (0, b'\xff\xf2'),
    'ogg': (0, b'OggS'),          # Ogg container
    'flac': (0, b'fLaC'),         # FLAC
    'webm': (0, b'\x1a\x45\xdf\xa3'),  # WebM/Matroska
    'm4a': (4, b'ftyp'),          # MP4/M4A (ftyp at offset 4)
}


def validate_audio_file(audio_file):
    """
    Validates an uploaded audio file for type, size, and content.
    
    Args:
        audio_file: FileStorage object from Flask request.files
        
    Returns:
        tuple: (is_valid: bool, error_message: str or None)
    """
    # Check filename exists
    if not audio_file.filename:
        return False, 'No audio file provided'
    
    # Check file extension
    filename = audio_file.filename.lower()
    ext = os.path.splitext(filename)[1]
    if ext not in ALLOWED_EXTENSIONS:
        return False, f'Invalid file extension. Allowed: {", ".join(sorted(ALLOWED_EXTENSIONS))}'
    
    # Check content-type header
    content_type = audio_file.content_type
    if content_type and content_type not in ALLOWED_AUDIO_TYPES:
        # Be lenient with content-type since browsers can be inconsistent
        # but log it for debugging
        logger.warning(f'Unexpected content-type: {content_type} for file: {filename}')
    
    # Check file size
    audio_file.seek(0, 2)  # Seek to end
    file_size = audio_file.tell()
    audio_file.seek(0)  # Reset to beginning
    
    if file_size == 0:
        return False, 'Audio file is empty'
    
    if file_size > MAX_AUDIO_SIZE_BYTES:
        return False, f'File size exceeds maximum limit of {MAX_AUDIO_SIZE_MB}MB'
    
    # Validate file content (magic bytes)
    header = audio_file.read(12)  # Read enough bytes for all checks
    audio_file.seek(0)  # Reset for later processing
    
    if len(header) < 4:
        return False, 'File too small to be valid audio'
    
    is_valid_audio = False
    for format_name, (offset, magic) in AUDIO_MAGIC_BYTES.items():
        if len(header) >= offset + len(magic):
            if header[offset:offset + len(magic)] == magic:
                is_valid_audio = True
                # Additional check for WAV: verify WAVE signature
                if format_name == 'wav' and len(header) >= 12:
                    if header[8:12] != b'WAVE':
                        continue  # Not actually a WAV file
                break
    
    if not is_valid_audio:
        return False, 'File does not appear to be valid audio data'
    
    return True, None


@app.route('/api/lexical', methods=['POST'])
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
    # Only used for local development (production uses gunicorn via Dockerfile)
    debug_mode = not IS_PRODUCTION
    logger.info(f"Starting Flask app in {'production' if IS_PRODUCTION else 'development'} mode")
    app.run(host='0.0.0.0', port=5000, debug=debug_mode)

