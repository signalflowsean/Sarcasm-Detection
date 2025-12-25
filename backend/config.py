"""
Configuration, constants, and logging setup for Sarcasm Detection API.
"""

import logging
import os

# ============================================================================
# Environment Configuration
# ============================================================================

FLASK_ENV = os.environ.get('FLASK_ENV', 'development')
IS_PRODUCTION = FLASK_ENV == 'production'

# ============================================================================
# Logging Configuration
# ============================================================================

logging.basicConfig(
    level=logging.INFO if IS_PRODUCTION else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# ============================================================================
# CORS Configuration
# ============================================================================

# In production, CORS_ORIGINS must be explicitly set (cannot be '*')
# Default to '*' only in development for convenience
#
# Railway Production Example:
#   CORS_ORIGINS=https://sarcasm-detector.com
#   (or comma-separated: https://sarcasm-detector.com,https://www.sarcasm-detector.com)
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*' if not IS_PRODUCTION else None)

# ============================================================================
# API Configuration
# ============================================================================

# Default API delay values (in seconds)
# Used to showcase loading animations in development
DEFAULT_API_DELAY_DEV = 1.2  # Development: 1.2 seconds delay
DEFAULT_API_DELAY_PROD = 0.0  # Production: no artificial delay

# Artificial delay in seconds to showcase loading animations
# Defaults to 0 in production, 1.2 in development
API_DELAY_SECONDS = float(
    os.environ.get(
        'API_DELAY_SECONDS',
        str(DEFAULT_API_DELAY_PROD if IS_PRODUCTION else DEFAULT_API_DELAY_DEV),
    )
)

# ============================================================================
# Rate Limiting Configuration
# ============================================================================
# Protects against abuse - ML inference is computationally expensive.
# Limits are per IP address. Format: "X per Y" (e.g., "10 per minute")

# Default global rate limit (applies to all endpoints)
RATE_LIMIT_DEFAULT = os.environ.get('RATE_LIMIT_DEFAULT', '60 per minute')

# Lexical endpoint limit (text processing is relatively cheap)
RATE_LIMIT_LEXICAL = os.environ.get('RATE_LIMIT_LEXICAL', '30 per minute')

# Prosodic endpoint limit (audio + ML inference is expensive)
RATE_LIMIT_PROSODIC = os.environ.get('RATE_LIMIT_PROSODIC', '10 per minute')

# Storage backend for rate limiting
# Options: 'memory' (default, single-process), 'redis://host:port' (distributed)
RATE_LIMIT_STORAGE = os.environ.get('RATE_LIMIT_STORAGE', 'memory://')

# Whether to enable rate limiting (can be disabled for development)
RATE_LIMIT_ENABLED = os.environ.get('RATE_LIMIT_ENABLED', 'true').lower() == 'true'

# ============================================================================
# Model Preloading Configuration
# ============================================================================

# Whether to preload models at module import time (before Flask app creation)
# Defaults to True for production (gunicorn --preload) and development convenience
# Set to False to disable preloading (models will load on first request)
# Useful for development when you want faster startup or are testing model loading
PRELOAD_MODELS = os.environ.get('PRELOAD_MODELS', 'true').lower() == 'true'

# ============================================================================
# Model Paths
# ============================================================================

BACKEND_DIR = os.path.dirname(__file__)
LEXICAL_MODEL_PATH = os.path.join(BACKEND_DIR, 'sarcasm_model.pkl')
PROSODIC_MODEL_PATH = os.path.join(BACKEND_DIR, 'prosodic_model.pkl')

# Wav2Vec2 configuration
WAV2VEC_MODEL_NAME = 'facebook/wav2vec2-base-960h'
TARGET_SAMPLE_RATE = 16000

# ============================================================================
# Text Input Validation
# ============================================================================

MAX_TEXT_LENGTH = 10000  # Maximum characters for lexical analysis

# ============================================================================
# Audio File Validation
# ============================================================================

# Max file size (aligned with nginx client_max_body_size of 50M)
MAX_AUDIO_SIZE_MB = 50
MAX_AUDIO_SIZE_BYTES = MAX_AUDIO_SIZE_MB * 1024 * 1024

# ============================================================================
# Audio Processing Configuration
# ============================================================================

# FFmpeg timeout for audio conversion (in seconds)
# Prevents hanging on corrupted or problematic audio files
# Default: 30 seconds (reasonable for most audio files)
# Can be overridden via FFMPEG_TIMEOUT environment variable
FFMPEG_TIMEOUT = int(os.environ.get('FFMPEG_TIMEOUT', '30'))

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
    'wav': (0, b'RIFF'),  # RIFF header (followed by WAVE at offset 8)
    'mp3_id3': (0, b'ID3'),  # MP3 with ID3 tag
    'mp3_sync': (0, b'\xff\xfb'),  # MP3 frame sync
    'mp3_sync2': (0, b'\xff\xfa'),
    'mp3_sync3': (0, b'\xff\xf3'),
    'mp3_sync4': (0, b'\xff\xf2'),
    'ogg': (0, b'OggS'),  # Ogg container
    'flac': (0, b'fLaC'),  # FLAC
    'webm': (0, b'\x1a\x45\xdf\xa3'),  # WebM/Matroska
    'm4a': (4, b'ftyp'),  # MP4/M4A (ftyp at offset 4)
}
