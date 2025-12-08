"""
Tests for audio validation utilities.
"""

import pytest
from io import BytesIO
from tests.mocks import create_mock_wav_audio, create_mock_mp3_audio, create_invalid_audio
from audio.validation import validate_audio_file


class MockFileStorage:
    """Mock Flask FileStorage object for testing."""
    
    def __init__(self, data: BytesIO, filename: str, content_type: str):
        self._data = data
        self.filename = filename
        self.content_type = content_type
    
    def seek(self, pos, whence=0):
        self._data.seek(pos, whence)
    
    def tell(self):
        return self._data.tell()
    
    def read(self, size=-1):
        return self._data.read(size)


def test_validate_audio_file_valid_wav():
    """Valid WAV file should pass validation."""
    audio = create_mock_wav_audio()
    mock_file = MockFileStorage(audio, 'test.wav', 'audio/wav')
    
    is_valid, error = validate_audio_file(mock_file)
    
    assert is_valid is True
    assert error is None


def test_validate_audio_file_valid_mp3():
    """Valid MP3 file should pass validation."""
    audio = create_mock_mp3_audio()
    mock_file = MockFileStorage(audio, 'test.mp3', 'audio/mpeg')
    
    is_valid, error = validate_audio_file(mock_file)
    
    assert is_valid is True
    assert error is None


def test_validate_audio_file_invalid_content():
    """Invalid audio content should fail validation."""
    audio = create_invalid_audio()
    mock_file = MockFileStorage(audio, 'test.wav', 'audio/wav')
    
    is_valid, error = validate_audio_file(mock_file)
    
    assert is_valid is False
    assert error is not None


def test_validate_audio_file_no_filename():
    """Missing filename should fail validation."""
    audio = create_mock_wav_audio()
    mock_file = MockFileStorage(audio, '', 'audio/wav')
    
    is_valid, error = validate_audio_file(mock_file)
    
    assert is_valid is False


def test_validate_audio_file_invalid_extension():
    """Invalid file extension should fail validation."""
    audio = create_mock_wav_audio()
    mock_file = MockFileStorage(audio, 'test.exe', 'audio/wav')
    
    is_valid, error = validate_audio_file(mock_file)
    
    assert is_valid is False


def test_validate_audio_file_empty():
    """Empty file should fail validation."""
    audio = BytesIO(b'')
    mock_file = MockFileStorage(audio, 'test.wav', 'audio/wav')
    
    is_valid, error = validate_audio_file(mock_file)
    
    assert is_valid is False

