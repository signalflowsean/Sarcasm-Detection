"""
Configuration, constants, and logging setup for Sarcasm Detection API.
"""

import ipaddress
import logging
import os
import re

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


def _validate_cors_origins(raw_origins: str | None, is_production: bool) -> str | None:
    """
    Validate CORS origins configuration.

    Args:
        raw_origins: Raw CORS origins string from environment
        is_production: Whether running in production mode

    Returns:
        Validated CORS origins string or None
    """
    if not raw_origins:
        if is_production:
            logger.error('[SECURITY] CORS_ORIGINS must be set in production')
            return None
        return '*'

    if not isinstance(raw_origins, str):
        logger.warning('[SECURITY] Invalid CORS_ORIGINS type')
        return '*' if not is_production else None

    # In production, '*' is not allowed
    if is_production and raw_origins.strip() == '*':
        logger.error('[SECURITY] CORS_ORIGINS cannot be "*" in production')
        return None

    # Validate each origin in comma-separated list
    origins_list = [origin.strip() for origin in raw_origins.split(',') if origin.strip()]
    validated_origins = []

    # Basic URL validation pattern
    # SECURITY: CORS origins must NOT include paths - only protocol, domain, and optional port
    # Allowing paths in CORS origins is a security vulnerability that could allow
    # attackers to bypass CORS restrictions by specifying paths
    url_pattern = re.compile(
        r'^https?://'  # http:// or https://
        r'(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+'  # Domain
        r'[a-zA-Z]{2,}'  # TLD
        r'(?::\d+)?$'  # Optional port (NO PATH ALLOWED)
    )

    for origin in origins_list:
        # Allow localhost in development only
        if not is_production and ('localhost' in origin.lower() or origin.startswith('http://')):
            validated_origins.append(origin)
            continue

        # In production, validate URL format
        if is_production:
            if 'localhost' in origin.lower() or origin.startswith('http://'):
                logger.warning(
                    f'[SECURITY] CORS origin contains localhost or HTTP-only: "{origin}". '
                    'This is unsafe for production.'
                )
                # Don't add it, but continue processing other origins
                continue

            if not url_pattern.match(origin):
                logger.warning(f'[SECURITY] Invalid CORS origin format: "{origin}", skipping')
                continue

        validated_origins.append(origin)

    if is_production and not validated_origins:
        logger.error('[SECURITY] No valid CORS origins found in production')
        return None

    return (
        ','.join(validated_origins) if validated_origins else ('*' if not is_production else None)
    )


_raw_cors_origins = os.environ.get('CORS_ORIGINS', '*' if not IS_PRODUCTION else None)
CORS_ORIGINS = _validate_cors_origins(_raw_cors_origins, IS_PRODUCTION)

# ============================================================================
# API Configuration
# ============================================================================

# Default API delay values (in seconds)
# Used to showcase loading animations in development
DEFAULT_API_DELAY_DEV = 1.2  # Development: 1.2 seconds delay
DEFAULT_API_DELAY_PROD = 0.0  # Production: no artificial delay

# Artificial delay in seconds to showcase loading animations
# Defaults to 0 in production, 1.2 in development
# SECURITY: Validate delay to prevent DoS attacks via extremely large delays
_raw_api_delay = os.environ.get(
    'API_DELAY_SECONDS',
    str(DEFAULT_API_DELAY_PROD if IS_PRODUCTION else DEFAULT_API_DELAY_DEV),
)
try:
    API_DELAY_SECONDS = float(_raw_api_delay)
    # Limit delay to reasonable maximum (5 minutes) to prevent DoS
    if API_DELAY_SECONDS < 0:
        logger.warning(
            f'[SECURITY] API_DELAY_SECONDS cannot be negative, using 0 instead of {API_DELAY_SECONDS}'
        )
        API_DELAY_SECONDS = 0.0
    elif API_DELAY_SECONDS > 300:  # 5 minutes max
        logger.warning(
            f'[SECURITY] API_DELAY_SECONDS too large ({API_DELAY_SECONDS}s), capping at 300s'
        )
        API_DELAY_SECONDS = 300.0
except (ValueError, TypeError):
    logger.warning(f'[SECURITY] Invalid API_DELAY_SECONDS value: {_raw_api_delay}, using default')
    API_DELAY_SECONDS = DEFAULT_API_DELAY_PROD if IS_PRODUCTION else DEFAULT_API_DELAY_DEV

# ============================================================================
# Rate Limiting Configuration
# ============================================================================
# Protects against abuse - ML inference is computationally expensive.
# Limits are per IP address. Format: "X per Y" (e.g., "10 per minute")


def _validate_rate_limit_string(rate_limit_str: str, default: str) -> str:
    """
    Validate rate limit string format.

    Expected format: "X per Y" where X is a positive integer and Y is a time unit.
    Valid time units: second, minute, hour, day

    Args:
        rate_limit_str: Rate limit string to validate
        default: Default value to use if validation fails

    Returns:
        Validated rate limit string
    """
    if not rate_limit_str or not isinstance(rate_limit_str, str):
        logger.warning(f'[SECURITY] Invalid rate limit string type, using default: {default}')
        return default

    rate_limit_str = rate_limit_str.strip()

    # Pattern: "X per Y" where X is digits and Y is a time unit
    pattern = r'^(\d+)\s+per\s+(second|minute|hour|day|seconds|minutes|hours|days)$'
    match = re.match(pattern, rate_limit_str, re.IGNORECASE)

    if not match:
        logger.warning(
            f'[SECURITY] Invalid rate limit format: "{rate_limit_str}", using default: {default}. '
            'Expected format: "X per Y" where X is a number and Y is second/minute/hour/day'
        )
        return default

    count = int(match.group(1))
    unit = match.group(2).lower().rstrip('s')  # Normalize plural forms

    # Validate count is reasonable (prevent DoS via extremely high limits)
    if count <= 0:
        logger.warning(f'[SECURITY] Rate limit count must be positive, using default: {default}')
        return default
    if count > 1000000:  # Prevent unreasonably high limits
        logger.warning(
            f'[SECURITY] Rate limit count too high ({count}), capping at 1000000. '
            f'Using default: {default}'
        )
        return default

    # Normalize unit (remove trailing 's')
    valid_units = {'second', 'minute', 'hour', 'day'}
    if unit not in valid_units:
        logger.warning(f'[SECURITY] Invalid rate limit unit: "{unit}", using default: {default}')
        return default

    # Return normalized format
    return f'{count} per {unit}'


def _validate_rate_limit_storage(storage_uri: str, default: str) -> str:
    """
    Validate rate limit storage URI.

    Allowed formats:
    - memory:// (default, single-process)
    - redis://host:port (distributed)
    - redis://host:port/db (with database number)

    Args:
        storage_uri: Storage URI to validate
        default: Default value to use if validation fails

    Returns:
        Validated storage URI
    """
    if not storage_uri or not isinstance(storage_uri, str):
        logger.warning(f'[SECURITY] Invalid storage URI type, using default: {default}')
        return default

    storage_uri = storage_uri.strip()

    # Allow memory://
    if storage_uri == 'memory://':
        return storage_uri

    # Validate redis:// format
    if storage_uri.startswith('redis://'):
        # Basic validation: redis://host:port or redis://host:port/db
        redis_pattern = r'^redis://([^:/]+)(?::(\d+))?(?:/(\d+))?$'
        match = re.match(redis_pattern, storage_uri)

        if not match:
            logger.warning(
                f'[SECURITY] Invalid Redis URI format: "{storage_uri}", using default: {default}. '
                'Expected format: redis://host:port or redis://host:port/db'
            )
            return default

        host = match.group(1)
        port = match.group(2)
        db = match.group(3)

        # Validate host (basic check - no injection characters)
        if not host or len(host) > 253:  # Max hostname length
            logger.warning(f'[SECURITY] Invalid Redis host, using default: {default}')
            return default

        # Validate port if provided
        if port:
            try:
                port_num = int(port)
                if port_num < 1 or port_num > 65535:
                    logger.warning(
                        f'[SECURITY] Invalid Redis port: {port_num}, using default: {default}'
                    )
                    return default
            except ValueError:
                logger.warning(f'[SECURITY] Invalid Redis port format, using default: {default}')
                return default

        # Validate database number if provided
        if db:
            try:
                db_num = int(db)
                if db_num < 0 or db_num > 15:  # Redis supports 0-15 databases by default
                    logger.warning(
                        f'[SECURITY] Invalid Redis database number: {db_num}, using default: {default}'
                    )
                    return default
            except ValueError:
                logger.warning(
                    f'[SECURITY] Invalid Redis database format, using default: {default}'
                )
                return default

        return storage_uri

    # Unknown format
    logger.warning(
        f'[SECURITY] Unknown storage URI format: "{storage_uri}", using default: {default}. '
        'Supported formats: memory:// or redis://host:port'
    )
    return default


# Default global rate limit (applies to all endpoints)
_raw_rate_limit_default = os.environ.get('RATE_LIMIT_DEFAULT', '60 per minute')
RATE_LIMIT_DEFAULT = _validate_rate_limit_string(_raw_rate_limit_default, '60 per minute')

# Lexical endpoint limit (text processing is relatively cheap)
_raw_rate_limit_lexical = os.environ.get('RATE_LIMIT_LEXICAL', '30 per minute')
RATE_LIMIT_LEXICAL = _validate_rate_limit_string(_raw_rate_limit_lexical, '30 per minute')

# Prosodic endpoint limit (audio + ML inference is expensive)
_raw_rate_limit_prosodic = os.environ.get('RATE_LIMIT_PROSODIC', '10 per minute')
RATE_LIMIT_PROSODIC = _validate_rate_limit_string(_raw_rate_limit_prosodic, '10 per minute')

# Storage backend for rate limiting
# Options: 'memory' (default, single-process), 'redis://host:port' (distributed)
_raw_rate_limit_storage = os.environ.get('RATE_LIMIT_STORAGE', 'memory://')
RATE_LIMIT_STORAGE = _validate_rate_limit_storage(_raw_rate_limit_storage, 'memory://')

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
# SECURITY: Validate timeout to prevent DoS attacks via extremely large timeouts or negative values
_raw_ffmpeg_timeout = os.environ.get('FFMPEG_TIMEOUT', '30')
try:
    FFMPEG_TIMEOUT = int(_raw_ffmpeg_timeout)
    # Limit timeout to reasonable range (1 second to 10 minutes) to prevent DoS
    if FFMPEG_TIMEOUT < 1:
        logger.warning(
            f'[SECURITY] FFMPEG_TIMEOUT cannot be less than 1 second, using 1 instead of {FFMPEG_TIMEOUT}'
        )
        FFMPEG_TIMEOUT = 1
    elif FFMPEG_TIMEOUT > 600:  # 10 minutes max
        logger.warning(f'[SECURITY] FFMPEG_TIMEOUT too large ({FFMPEG_TIMEOUT}s), capping at 600s')
        FFMPEG_TIMEOUT = 600
except (ValueError, TypeError):
    logger.warning(
        f'[SECURITY] Invalid FFMPEG_TIMEOUT value: {_raw_ffmpeg_timeout}, using default 30'
    )
    FFMPEG_TIMEOUT = 30

# ============================================================================
# Rate Limiting Security Configuration
# ============================================================================


# Trusted proxy IPs/ranges for X-Forwarded-For header validation
# Only trust X-Forwarded-For headers if request comes from these IPs
# Format: comma-separated list of IPs or CIDR ranges (e.g., "127.0.0.1,10.0.0.0/8")
# Default: localhost only (development). In production, set to your proxy IPs.
# Examples:
#   - Railway: Check Railway docs for proxy IP ranges
#   - Nginx reverse proxy: Set to nginx container IP or host IP
#   - Cloudflare: Use Cloudflare IP ranges (see: https://www.cloudflare.com/ips/)
# SECURITY: Filter out empty strings to prevent issues with malformed config
def _validate_trusted_proxy_ips(raw_ips: str, default: list[str]) -> list[str]:
    """
    Validate trusted proxy IPs/CIDR ranges.

    Args:
        raw_ips: Comma-separated string of IPs/CIDR ranges
        default: Default list to use if validation fails

    Returns:
        List of validated IP addresses or CIDR ranges
    """
    if not raw_ips or not isinstance(raw_ips, str):
        logger.warning('[SECURITY] Invalid TRUSTED_PROXY_IPS type, using default')
        return default

    validated_ips = []
    ip_list = [ip.strip() for ip in raw_ips.split(',') if ip.strip()]

    for ip_str in ip_list:
        try:
            # Try to validate as IP address or CIDR range
            if '/' in ip_str:
                # CIDR range
                ipaddress.ip_network(ip_str, strict=False)
            else:
                # Single IP address
                ipaddress.ip_address(ip_str)
            validated_ips.append(ip_str)
        except ValueError as e:
            logger.warning(
                f'[SECURITY] Invalid trusted proxy IP/CIDR: "{ip_str}", skipping. Error: {e}'
            )

    if not validated_ips:
        logger.warning(f'[SECURITY] No valid trusted proxy IPs found, using default: {default}')
        return default

    return validated_ips


_raw_trusted_proxy_ips = os.environ.get('TRUSTED_PROXY_IPS', '127.0.0.1,::1')
TRUSTED_PROXY_IPS = _validate_trusted_proxy_ips(_raw_trusted_proxy_ips, ['127.0.0.1', '::1'])

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
