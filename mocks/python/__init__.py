"""
Shared mocks for Python tests.

Usage:
    from mocks.python import create_mock_wav, MockLexicalModel
    from mocks.python import test_phrases, api_responses
"""

from .audio import (
    create_mock_wav,
    create_mock_mp3,
    create_invalid_audio,
    create_empty_file,
)
from .models import MockLexicalModel, MockProsodicModel
from .fixtures import test_phrases, api_responses

__all__ = [
    # Audio
    "create_mock_wav",
    "create_mock_mp3",
    "create_invalid_audio",
    "create_empty_file",
    # Models
    "MockLexicalModel",
    "MockProsodicModel",
    # Fixtures
    "test_phrases",
    "api_responses",
]
