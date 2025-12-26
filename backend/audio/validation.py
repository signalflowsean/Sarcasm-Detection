"""
Audio file validation utilities.
Validates file type, size, and content integrity.

Security: User-facing error messages are sanitized to avoid leaking
internal details. Detailed validation failures are logged internally.
"""

import logging
import os

from config import (
    ALLOWED_AUDIO_TYPES,
    ALLOWED_EXTENSIONS,
    AUDIO_MAGIC_BYTES,
    MAX_AUDIO_SIZE_BYTES,
)
from errors import UserError

logger = logging.getLogger(__name__)


def validate_audio_file(audio_file, request=None) -> tuple:
    """
    Validates an uploaded audio file for type, size, and content.

    Performance: Checks Content-Length header first to avoid reading large files
    into memory. Falls back to seeking method if Content-Length is unavailable.

    Args:
        audio_file: FileStorage object from Flask request.files.
        request: Optional Flask request object for accessing Content-Length header.

    Returns:
        tuple: (is_valid: bool, error_message: str or None)

    Note:
        Error messages returned are sanitized for user safety.
        Detailed validation info is logged internally.
    """
    # Check filename exists
    if not audio_file.filename:
        return False, UserError.AUDIO_MISSING

    # Check file extension
    filename = audio_file.filename.lower()
    ext = os.path.splitext(filename)[1]
    if ext not in ALLOWED_EXTENSIONS:
        # Log details internally, return generic message to user
        logger.warning(f"[VALIDATION] Rejected file extension '{ext}' for file: {filename}")
        return False, UserError.AUDIO_INVALID_TYPE

    # Check content-type header
    # Browser may send "audio/webm;codecs=opus" so we check prefix, not exact match
    content_type = audio_file.content_type
    if content_type:
        base_type = content_type.split(';')[0].strip()  # Strip codec info
        if base_type not in ALLOWED_AUDIO_TYPES:
            # Be lenient with content-type since browsers can be inconsistent
            # but log it for debugging
            logger.warning(
                f'[VALIDATION] Unexpected content-type: {content_type} for file: {filename}'
            )

    # PERFORMANCE: Early rejection using Content-Length header (if available)
    # For multipart/form-data, Content-Length includes boundaries, so it's an upper bound.
    # This allows early rejection of obviously too-large requests before processing.
    # SECURITY: Validate Content-Length to prevent DoS attacks via negative or overflow values
    if request is not None:
        content_length = request.headers.get('Content-Length')
        if content_length:
            try:
                # SECURITY: Check for negative values and integer overflow
                # Python int() can handle arbitrarily large integers, but we need to validate
                # reasonable bounds to prevent DoS attacks
                request_size = int(content_length)

                # SECURITY: Reject negative Content-Length (malicious or corrupted header)
                if request_size < 0:
                    logger.warning(
                        f'[VALIDATION SECURITY] Negative Content-Length header: {request_size}'
                    )
                    return False, UserError.AUDIO_INVALID_CONTENT

                # SECURITY: Reject extremely large values that could cause integer overflow
                # or memory exhaustion (max 64-bit signed integer is ~9 exabytes)
                # Use a reasonable upper bound: 100GB (100 * 1024^3 bytes)
                MAX_REASONABLE_CONTENT_LENGTH = 100 * 1024 * 1024 * 1024  # 100GB
                if request_size > MAX_REASONABLE_CONTENT_LENGTH:
                    logger.warning(
                        f'[VALIDATION SECURITY] Content-Length too large (potential DoS): {request_size} bytes'
                    )
                    return False, UserError.AUDIO_TOO_LARGE

                # Content-Length for multipart includes boundaries (~200-500 bytes overhead)
                # plus some form field metadata. Use a conservative 4KB buffer which is sufficient
                # for multipart boundaries and field names while detecting actual oversized files.
                MULTIPART_OVERHEAD_BUFFER = 4 * 1024  # 4KB - sufficient for multipart boundaries
                early_reject_threshold = MAX_AUDIO_SIZE_BYTES + MULTIPART_OVERHEAD_BUFFER
                if request_size > early_reject_threshold:
                    logger.warning(
                        f'[VALIDATION] Request too large (Content-Length): {request_size} bytes '
                        f'(max: {MAX_AUDIO_SIZE_BYTES})'
                    )
                    return False, UserError.AUDIO_TOO_LARGE
                logger.debug(f'[VALIDATION] Content-Length check passed: {request_size} bytes')
            except (ValueError, TypeError, OverflowError):
                # Invalid Content-Length header (non-numeric, overflow, etc.) - continue with file size check
                logger.debug('[VALIDATION] Invalid Content-Length header, skipping early check')

    # Check actual file size by seeking to end
    # This is efficient for FileStorage objects (doesn't read entire file into memory)
    # FileStorage uses a temporary file or BytesIO, so seeking is fast
    audio_file.seek(0, 2)  # Seek to end
    file_size = audio_file.tell()
    audio_file.seek(0)  # Reset to beginning for content validation

    if file_size == 0:
        return False, UserError.AUDIO_EMPTY

    if file_size > MAX_AUDIO_SIZE_BYTES:
        # Log actual size internally
        logger.warning(
            f'[VALIDATION] File too large: {file_size} bytes (max: {MAX_AUDIO_SIZE_BYTES})'
        )
        return False, UserError.AUDIO_TOO_LARGE

    # Validate file content (magic bytes)
    header = audio_file.read(12)  # Read enough bytes for all checks
    audio_file.seek(0)  # Reset for later processing

    if len(header) < 4:
        logger.warning(f'[VALIDATION] File too small: {len(header)} bytes header')
        return False, UserError.AUDIO_INVALID_CONTENT

    is_valid_audio = False
    detected_format = None
    for format_name, (offset, magic) in AUDIO_MAGIC_BYTES.items():
        if len(header) >= offset + len(magic):
            if header[offset : offset + len(magic)] == magic:
                # Additional check for WAV: verify WAVE signature
                if format_name == 'wav':
                    if len(header) < 12 or header[8:12] != b'WAVE':
                        continue  # Not actually a WAV file, check other formats
                # All format-specific checks passed
                is_valid_audio = True
                detected_format = format_name
                break

    if not is_valid_audio:
        # Don't log raw bytes - could leak file structure information
        logger.warning('[VALIDATION] Invalid audio format detected (magic bytes mismatch)')
        return False, UserError.AUDIO_INVALID_CONTENT

    # Only log format type, not detailed file information
    logger.debug(f'[VALIDATION] Valid audio file detected (format: {detected_format})')
    return True, None
