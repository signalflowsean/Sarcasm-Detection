"""
Audio file validation utilities.
Validates file type, size, and content integrity.
"""

import os
import logging

from config import (
    ALLOWED_AUDIO_TYPES,
    ALLOWED_EXTENSIONS,
    AUDIO_MAGIC_BYTES,
    MAX_AUDIO_SIZE_BYTES,
    MAX_AUDIO_SIZE_MB,
)

logger = logging.getLogger(__name__)


def validate_audio_file(audio_file) -> tuple:
    """
    Validates an uploaded audio file for type, size, and content.
    
    Args:
        audio_file: FileStorage object from Flask request.files.
        
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

