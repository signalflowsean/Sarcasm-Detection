"""
Audio processing package for sarcasm detection.
Provides audio decoding, preprocessing, and validation functionality.
"""

from .processing import decode_audio, extract_embedding, preprocess_audio
from .validation import validate_audio_file

__all__ = [
    'decode_audio',
    'preprocess_audio',
    'extract_embedding',
    'validate_audio_file',
]
