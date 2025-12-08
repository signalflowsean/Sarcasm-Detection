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
