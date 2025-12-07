"""
Error handling utilities.
Provides sanitized error messages for users while logging detailed info internally.

Security: User-facing error messages should be generic to avoid leaking
implementation details (file paths, stack traces, internal error messages).
"""

import logging

logger = logging.getLogger(__name__)


# ============================================================================
# User-Facing Error Messages (Safe to expose)
# ============================================================================

class UserError:
    """Predefined user-safe error messages."""
    
    # Audio validation errors
    AUDIO_MISSING = "No audio file provided"
    AUDIO_EMPTY = "Audio file is empty"
    AUDIO_TOO_LARGE = "File size exceeds the maximum limit"
    AUDIO_INVALID_TYPE = "Invalid audio file type"
    AUDIO_INVALID_CONTENT = "File does not appear to be valid audio"
    AUDIO_TOO_SHORT = "Audio is too short for analysis"
    AUDIO_DECODE_FAILED = "Could not process audio file"
    AUDIO_PROCESSING_FAILED = "Audio processing failed"
    
    # Text validation errors
    TEXT_MISSING = "Missing required field: text"
    TEXT_INVALID = "Text must be a non-empty string"
    TEXT_TOO_LONG = "Text exceeds the maximum length"
    
    # General errors
    RATE_LIMITED = "Rate limit exceeded. Please slow down your requests."
    INTERNAL_ERROR = "An internal error occurred"
    MODEL_UNAVAILABLE = "Service temporarily unavailable"


def log_and_sanitize(
    internal_message: str,
    user_message: str,
    level: str = "error"
) -> str:
    """
    Log detailed error internally and return sanitized message for user.
    
    Args:
        internal_message: Detailed message for logs (may contain sensitive info)
        user_message: Safe message to return to user
        level: Log level ('debug', 'info', 'warning', 'error')
        
    Returns:
        The user-safe message
    """
    log_func = getattr(logger, level, logger.error)
    log_func(f"[INTERNAL] {internal_message}")
    return user_message

