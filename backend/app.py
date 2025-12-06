"""
Flask backend for Sarcasm Detection API.
Provides endpoints for lexical (text-based) and prosodic (audio-based) sarcasm detection.
"""

import os
import io
import random
import time
import uuid
import logging
import pickle
import numpy as np
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

# ============================================================================
# Model Loading
# ============================================================================

# Load the lexical sarcasm detection model (scikit-learn pipeline saved as pickle)
LEXICAL_MODEL_PATH = os.path.join(os.path.dirname(__file__), 'sarcasm_model.pkl')

lexical_model = None
if os.path.exists(LEXICAL_MODEL_PATH):
    logger.info(f"Loading lexical model from: {LEXICAL_MODEL_PATH}")
    with open(LEXICAL_MODEL_PATH, 'rb') as f:
        lexical_model = pickle.load(f)
    logger.info("Lexical model loaded successfully")
else:
    logger.warning(f"Could not find lexical model at {LEXICAL_MODEL_PATH} - lexical endpoint will return mock data")

# Load the prosodic sarcasm detection model (Wav2Vec2 + classifier)
PROSODIC_MODEL_PATH = os.path.join(os.path.dirname(__file__), 'prosodic_model.pkl')
WAV2VEC_MODEL_NAME = "facebook/wav2vec2-base-960h"
TARGET_SAMPLE_RATE = 16000

# Prosodic model components (lazy-loaded)
prosodic_model = None
wav2vec_processor = None
wav2vec_model = None
torch_available = False

# Try to load PyTorch and transformers for prosodic model
try:
    import torch
    import torchaudio
    import soundfile as sf
    from transformers import Wav2Vec2Processor, Wav2Vec2Model
    torch_available = True
    logger.info("PyTorch and transformers loaded successfully")
except ImportError as e:
    logger.warning(f"Could not import PyTorch/transformers: {e}")
    logger.warning("Prosodic endpoint will return mock data")


def load_prosodic_models():
    """
    Lazy-load prosodic model components.
    Called on first prosodic request to avoid slow startup.
    """
    global prosodic_model, wav2vec_processor, wav2vec_model
    
    if not torch_available:
        return False
    
    # Load Wav2Vec2 encoder
    if wav2vec_processor is None or wav2vec_model is None:
        logger.info(f"Loading Wav2Vec2 model: {WAV2VEC_MODEL_NAME}")
        try:
            wav2vec_processor = Wav2Vec2Processor.from_pretrained(WAV2VEC_MODEL_NAME)
            wav2vec_model = Wav2Vec2Model.from_pretrained(WAV2VEC_MODEL_NAME)
            wav2vec_model.eval()
            logger.info("Wav2Vec2 model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Wav2Vec2 model: {e}")
            return False
    
    # Load classifier
    if prosodic_model is None and os.path.exists(PROSODIC_MODEL_PATH):
        logger.info(f"Loading prosodic classifier from: {PROSODIC_MODEL_PATH}")
        try:
            with open(PROSODIC_MODEL_PATH, 'rb') as f:
                prosodic_model = pickle.load(f)
            logger.info("Prosodic classifier loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load prosodic classifier: {e}")
            return False
    elif prosodic_model is None:
        logger.warning(f"Could not find prosodic model at {PROSODIC_MODEL_PATH}")
        return False
    
    return True


def decode_audio(audio_bytes: bytes) -> tuple:
    """
    Decode audio bytes to waveform using soundfile.
    Handles multiple formats (WAV, FLAC, OGG, etc.)
    
    Args:
        audio_bytes: Raw audio file bytes
        
    Returns:
        tuple: (waveform as numpy array, sample_rate)
    """
    # Use soundfile to decode (supports WAV, FLAC, OGG)
    audio_buffer = io.BytesIO(audio_bytes)
    try:
        waveform, sr = sf.read(audio_buffer)
        return waveform, sr
    except Exception as e:
        logger.debug(f"soundfile failed: {e}, trying torchaudio")
    
    # Fallback to torchaudio for formats soundfile doesn't handle (MP3, M4A, etc.)
    audio_buffer.seek(0)
    try:
        waveform, sr = torchaudio.load(audio_buffer)
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
        waveform: Audio waveform as numpy array
        sr: Sample rate
        
    Returns:
        Preprocessed waveform as 1D numpy array
    """
    # Convert to mono if stereo
    if waveform.ndim == 2:
        waveform = waveform.mean(axis=1)
    
    # Resample to 16kHz if necessary
    if sr != TARGET_SAMPLE_RATE:
        # Use torchaudio for resampling
        waveform_tensor = torch.tensor(waveform).unsqueeze(0).float()
        resampler = torchaudio.transforms.Resample(sr, TARGET_SAMPLE_RATE)
        waveform_tensor = resampler(waveform_tensor)
        waveform = waveform_tensor.squeeze(0).numpy()
    
    # Normalize (zero mean, unit variance)
    waveform = (waveform - waveform.mean()) / (waveform.std() + 1e-9)
    
    return waveform


def extract_prosodic_embedding(waveform: np.ndarray) -> np.ndarray:
    """
    Extract Wav2Vec2 embedding from preprocessed audio.
    
    Args:
        waveform: Preprocessed audio waveform (1D numpy array, 16kHz, normalized)
        
    Returns:
        Embedding as numpy array of shape (768,)
    """
    # Prepare input for Wav2Vec2
    inputs = wav2vec_processor(
        waveform,
        sampling_rate=TARGET_SAMPLE_RATE,
        return_tensors="pt",
        padding=True
    )
    
    # Extract embedding
    with torch.no_grad():
        outputs = wav2vec_model(inputs.input_values)
        # Mean pool over time dimension
        embedding = outputs.last_hidden_state.mean(dim=1).squeeze(0).numpy()
    
    return embedding


# ============================================================================
# Flask App Configuration
# ============================================================================

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


# ============================================================================
# API Endpoints
# ============================================================================

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
    
    # Use the actual lexical model for prediction
    if lexical_model is not None:
        try:
            # Get probability of sarcastic class
            score = float(lexical_model.predict_proba([text.strip()])[0][1])
            logger.debug(f"Lexical prediction for '{text[:50]}...': {score:.4f}")
        except Exception as e:
            logger.error(f"Error during lexical prediction: {e}")
            # Fallback to random on error
            score = random.random()
    else:
        # Fallback to random if model not loaded
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
    
    if models_loaded and prosodic_model is not None:
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
            embedding = extract_prosodic_embedding(waveform)
            logger.debug(f"Extracted embedding: shape {embedding.shape}")
            
            # Predict sarcasm score
            embedding_2d = embedding.reshape(1, -1)
            score = float(prosodic_model.predict_proba(embedding_2d)[0, 1])
            logger.debug(f"Prosodic prediction: {score:.4f}")
            
        except Exception as e:
            logger.error(f"Error during prosodic prediction: {e}")
            # Fallback to random on error
            score = random.random()
    else:
        # Fallback to random if model not loaded
        logger.warning("Prosodic model not available, returning random score")
        score = random.random()
    
    return jsonify({
        'id': str(uuid.uuid4()),
        'value': score
    })


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint for container orchestration."""
    return jsonify({
        'status': 'healthy',
        'models': {
            'lexical': lexical_model is not None,
            'prosodic': prosodic_model is not None,
            'wav2vec': wav2vec_model is not None
        }
    })


if __name__ == '__main__':
    # Only used for local development (production uses gunicorn via Dockerfile)
    debug_mode = not IS_PRODUCTION
    logger.info(f"Starting Flask app in {'production' if IS_PRODUCTION else 'development'} mode")
    app.run(host='0.0.0.0', port=5000, debug=debug_mode)
