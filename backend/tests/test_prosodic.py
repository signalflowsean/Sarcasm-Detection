"""
Tests for prosodic (audio-based) sarcasm detection endpoint.
"""

from tests.mocks import create_empty_file, create_invalid_audio, create_mock_wav_audio


def test_prosodic_missing_audio_returns_400(client):
    """Prosodic endpoint should return 400 when audio file is missing."""
    response = client.post('/api/prosodic')

    assert response.status_code == 400
    data = response.get_json()
    assert 'error' in data


def test_prosodic_empty_file_returns_400(client):
    """Prosodic endpoint should return 400 for empty audio file."""
    data = {'audio': (create_empty_file(), 'test.wav', 'audio/wav')}
    response = client.post('/api/prosodic', data=data, content_type='multipart/form-data')

    assert response.status_code == 400


def test_prosodic_invalid_audio_returns_400(client):
    """Prosodic endpoint should return 400 for invalid audio content."""
    data = {'audio': (create_invalid_audio(), 'test.wav', 'audio/wav')}
    response = client.post('/api/prosodic', data=data, content_type='multipart/form-data')

    assert response.status_code == 400


def test_prosodic_invalid_extension_returns_400(client):
    """Prosodic endpoint should return 400 for invalid file extension."""
    data = {'audio': (create_mock_wav_audio(), 'test.txt', 'text/plain')}
    response = client.post('/api/prosodic', data=data, content_type='multipart/form-data')

    assert response.status_code == 400


def test_prosodic_valid_wav_returns_200(client):
    """Prosodic endpoint should return 200 with valid WAV file."""
    data = {'audio': (create_mock_wav_audio(), 'test.wav', 'audio/wav')}
    response = client.post('/api/prosodic', data=data, content_type='multipart/form-data')

    # Should return 200 even if model isn't loaded (fallback behavior)
    assert response.status_code == 200
    result = response.get_json()

    assert 'id' in result
    assert 'value' in result
    assert 'reliable' in result
    assert 0.0 <= result['value'] <= 1.0


def test_prosodic_response_structure(client):
    """Prosodic endpoint should return correct response structure."""
    data = {'audio': (create_mock_wav_audio(), 'test.wav', 'audio/wav')}
    response = client.post('/api/prosodic', data=data, content_type='multipart/form-data')

    result = response.get_json()

    # Check all required fields exist
    assert isinstance(result.get('id'), str)
    assert isinstance(result.get('value'), (int, float))
    assert isinstance(result.get('reliable'), bool)


def test_prosodic_expected_valueerror_returns_fallback(client):
    """Prosodic endpoint should return fallback score for expected ValueError (audio decode failure)."""
    # Create a file that will fail to decode (invalid audio format)
    invalid_audio_bytes = b'This is not audio data'
    data = {'audio': (invalid_audio_bytes, 'test.wav', 'audio/wav')}
    response = client.post('/api/prosodic', data=data, content_type='multipart/form-data')

    # Should return 200 with fallback score (not 500)
    assert response.status_code == 200
    result = response.get_json()
    assert result['value'] == 0.5  # Fallback score
    assert result['reliable'] is False


def test_prosodic_unexpected_error_raises_500(client, monkeypatch):
    """Prosodic endpoint should return 500 for unexpected errors."""

    # Mock extract_embedding to raise an unexpected error
    def mock_extract_embedding(*args, **kwargs):
        raise KeyError('Unexpected error that should not be caught')

    from audio import processing

    monkeypatch.setattr(processing, 'extract_embedding', mock_extract_embedding)

    data = {'audio': (create_mock_wav_audio(), 'test.wav', 'audio/wav')}
    response = client.post('/api/prosodic', data=data, content_type='multipart/form-data')

    # Should return 500 for unexpected errors (not fallback)
    assert response.status_code == 500
    result = response.get_json()
    assert 'error' in result
