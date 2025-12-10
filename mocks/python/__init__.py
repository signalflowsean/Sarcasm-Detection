"""
Shared mocks for Python tests.

Usage:
    from mocks.python import create_mock_wav, MockLexicalModel
    from mocks.python import test_phrases, api_responses

Note: Requires the project root to be in sys.path.
For backend tests, this is handled by backend/tests/conftest.py.
"""

from .audio import (
    create_empty_file,
    create_invalid_audio,
    create_mock_mp3,
    create_mock_wav,
    load_test_audio_fixture,
)
from .fixtures import api_responses, test_phrases
from .models import MockLexicalModel, MockProsodicModel, MockWav2Vec2

__all__ = [
    # Audio
    "create_mock_wav",
    "create_mock_mp3",
    "create_invalid_audio",
    "create_empty_file",
    "load_test_audio_fixture",
    # Models
    "MockLexicalModel",
    "MockProsodicModel",
    "MockWav2Vec2",
    # Fixtures
    "test_phrases",
    "api_responses",
]
