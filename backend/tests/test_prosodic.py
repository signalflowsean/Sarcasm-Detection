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
