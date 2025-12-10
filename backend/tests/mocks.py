"""
Mock objects for backend tests.

Re-exports from shared mocks (mocks/python/) for convenience.
Backend tests can import from here instead of the full path:

    from tests.mocks import create_mock_wav, MockLexicalModel

Note: This module relies on conftest.py adding the project root to sys.path.
The conftest.py fixture runs before any test imports, ensuring mocks.python
is importable. See backend/tests/conftest.py for the path setup.
"""

# Re-export from shared mocks
# These imports work because conftest.py adds the project root to sys.path
from mocks.python import (
    MockLexicalModel,
    MockProsodicModel,
    MockWav2Vec2,
    api_responses,
    create_empty_file,
    create_invalid_audio,
    create_mock_mp3,
    create_mock_wav,
    load_test_audio_fixture,
    test_phrases,
)

# Backward compatibility aliases
create_mock_wav_audio = create_mock_wav
create_mock_mp3_audio = create_mock_mp3

__all__ = [
    # Audio
    'create_mock_wav',
    'create_mock_wav_audio',  # Deprecated alias
    'create_mock_mp3',
    'create_mock_mp3_audio',  # Deprecated alias
    'create_invalid_audio',
    'create_empty_file',
    'load_test_audio_fixture',
    # Models
    'MockLexicalModel',
    'MockProsodicModel',
    'MockWav2Vec2',
    # Fixtures
    'test_phrases',
    'api_responses',
]
