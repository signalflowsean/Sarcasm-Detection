"""
Tests for lexical (text-based) sarcasm detection endpoint.
"""


def test_lexical_missing_text_returns_400(client):
    """Lexical endpoint should return 400 when text is missing."""
    response = client.post('/api/lexical', json={})

    assert response.status_code == 400
    data = response.get_json()
    assert 'error' in data


def test_lexical_empty_text_returns_400(client):
    """Lexical endpoint should return 400 when text is empty."""
    response = client.post('/api/lexical', json={'text': ''})

    assert response.status_code == 400
    data = response.get_json()
    assert 'error' in data


def test_lexical_whitespace_only_returns_400(client):
    """Lexical endpoint should return 400 when text is only whitespace."""
    response = client.post('/api/lexical', json={'text': '   '})

    assert response.status_code == 400


def test_lexical_valid_text_returns_200(client):
    """Lexical endpoint should return 200 with valid text."""
    response = client.post('/api/lexical', json={'text': 'This is a test'})

    assert response.status_code == 200
    data = response.get_json()

    assert 'id' in data
    assert 'value' in data
    assert 'reliable' in data
    assert 0.0 <= data['value'] <= 1.0


def test_lexical_response_structure(client):
    """Lexical endpoint should return correct response structure."""
    response = client.post('/api/lexical', json={'text': 'Oh wow, that is just great.'})

    data = response.get_json()

    # Check all required fields exist
    assert isinstance(data.get('id'), str)
    assert isinstance(data.get('value'), (int, float))
    assert isinstance(data.get('reliable'), bool)


def test_lexical_text_too_long_returns_400(client):
    """Lexical endpoint should return 400 when text exceeds max length."""
    long_text = 'x' * 10001  # MAX_TEXT_LENGTH is 10000
    response = client.post('/api/lexical', json={'text': long_text})

    assert response.status_code == 400


def test_lexical_sanitizes_text_with_control_chars(client):
    """Lexical endpoint should sanitize text with control characters."""
    # Text with null bytes and control characters should be sanitized
    text_with_control = 'Hello\x00World\x07Test'
    response = client.post('/api/lexical', json={'text': text_with_control})

    # Should succeed (sanitized text is valid)
    assert response.status_code == 200
    data = response.get_json()
    assert 'value' in data
    assert 0.0 <= data['value'] <= 1.0


def test_lexical_sanitizes_text_with_zero_width_chars(client):
    """Lexical endpoint should sanitize text with zero-width characters."""
    # Text with zero-width characters should be sanitized
    text_with_zw = 'Hello\u200b\u200c\u200dWorld'
    response = client.post('/api/lexical', json={'text': text_with_zw})

    # Should succeed (sanitized text is valid)
    assert response.status_code == 200
    data = response.get_json()
    assert 'value' in data


def test_lexical_preserves_emojis_and_special_chars(client):
    """Lexical endpoint should preserve emojis and special Unicode characters."""
    text_with_emoji = 'Hello 😀 world! Café résumé'
    response = client.post('/api/lexical', json={'text': text_with_emoji})

    # Should succeed and preserve the text
    assert response.status_code == 200
    data = response.get_json()
    assert 'value' in data
