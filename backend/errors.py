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
    AUDIO_MISSING = 'No audio file provided'
    AUDIO_EMPTY = 'Audio file is empty'
    AUDIO_TOO_LARGE = 'File size exceeds the maximum limit'
    AUDIO_INVALID_TYPE = 'Invalid audio file type'
    AUDIO_INVALID_CONTENT = 'File does not appear to be valid audio'
    AUDIO_TOO_SHORT = 'Audio is too short for analysis'
    AUDIO_DECODE_FAILED = 'Could not process audio file'
    AUDIO_PROCESSING_FAILED = 'Audio processing failed'

    # Text validation errors
    TEXT_MISSING = 'Missing required field: text'
    TEXT_INVALID = 'Text must be a non-empty string'
    TEXT_TOO_LONG = 'Text exceeds the maximum length'

    # General errors
    RATE_LIMITED = 'Rate limit exceeded. Please slow down your requests.'
    INTERNAL_ERROR = 'An internal error occurred'
    MODEL_UNAVAILABLE = 'Service temporarily unavailable'


# ============================================================================
# Custom Exception Hierarchy
# ============================================================================


class AudioProcessingError(Exception):
    """
    Base exception for audio processing failures.

    This exception (and its subclasses) explicitly define the contract between
    audio processing functions and route handlers, making error handling more
    maintainable than relying on generic Python exceptions.

    Attributes:
        user_message: Safe message to return to users
        internal_message: Detailed message for internal logging (may contain sensitive info)
    """

    def __init__(self, user_message: str, internal_message: str = None):
        self.user_message = user_message
        self.internal_message = internal_message or user_message
        super().__init__(self.internal_message)


class AudioDecodingError(AudioProcessingError):
    """
    Raised when audio file cannot be decoded.

    Indicates user input issues (invalid format, corrupt file, unsupported codec).
    Route handlers should return a fallback score for graceful degradation.
    """

    def __init__(self, internal_message: str = None):
        super().__init__(
            user_message=UserError.AUDIO_DECODE_FAILED, internal_message=internal_message
        )


class AudioValidationError(AudioProcessingError):
    """
    Raised when audio validation fails.

    Indicates audio doesn't meet requirements (too short, empty, invalid type).
    Route handlers should return a 400 error.
    """

    def __init__(self, user_message: str, internal_message: str = None):
        super().__init__(user_message=user_message, internal_message=internal_message)


class ModelUnavailableError(AudioProcessingError):
    """
    Raised when ML model is unavailable or inference fails.

    Indicates expected service degradation (model loading failed, ONNX error).
    Route handlers should return a fallback score for graceful degradation.
    """

    def __init__(self, internal_message: str = None):
        super().__init__(
            user_message=UserError.MODEL_UNAVAILABLE, internal_message=internal_message
        )


def log_and_sanitize(internal_message: str, user_message: str, level: str = 'error') -> str:
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
    log_func(f'[INTERNAL] {internal_message}')
    return user_message
