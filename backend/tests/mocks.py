"""
Mock objects for testing.
Re-exports from shared mocks for convenience.
"""

import sys
from pathlib import Path

# Add mocks to path for imports
_mocks_path = Path(__file__).parent.parent.parent / 'mocks'
if str(_mocks_path) not in sys.path:
    sys.path.insert(0, str(_mocks_path))

# Re-export from shared mocks
# ruff: noqa: E402 (imports must come after sys.path modification)
from python.audio import (
    create_empty_file,
    create_invalid_audio,
    create_mock_mp3,
    create_mock_wav,
    load_test_audio_fixture,
)
from python.fixtures import api_responses, test_phrases
from python.models import MockLexicalModel, MockProsodicModel, MockWav2Vec2

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
