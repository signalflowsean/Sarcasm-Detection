"""
Tests for rate limiting key function with proxy headers.
"""

from extensions import _is_valid_ip, get_rate_limit_key


def test_is_valid_ip():
    """Test IP validation function."""
    # Valid IPv4
    assert _is_valid_ip('192.168.1.1') is True
    assert _is_valid_ip('127.0.0.1') is True
    assert _is_valid_ip('10.0.0.1') is True

    # Invalid IPv4
    assert _is_valid_ip('256.1.1.1') is False  # Octet > 255
    assert _is_valid_ip('192.168.1') is False  # Missing octet
    assert _is_valid_ip('192.168.1.1.1') is False  # Too many octets

    # Valid IPv6
    assert _is_valid_ip('::1') is True  # Localhost
    assert _is_valid_ip('2001:0db8:85a3:0000:0000:8a2e:0370:7334') is True

    # Invalid
    assert _is_valid_ip('invalid') is False
    assert _is_valid_ip('') is False
    assert _is_valid_ip(None) is False


def test_rate_limit_key_with_x_forwarded_for(app):
    """Test rate limiting key uses X-Forwarded-For header."""
    with app.test_request_context(
        '/api/lexical', method='POST', headers={'X-Forwarded-For': '192.168.1.100'}
    ):
        key = get_rate_limit_key()
        assert key == '192.168.1.100'


def test_rate_limit_key_with_multiple_ips(app):
    """Test rate limiting key uses first IP in X-Forwarded-For chain."""
    with app.test_request_context(
        '/api/lexical',
        method='POST',
        headers={'X-Forwarded-For': '10.0.0.50, 192.168.1.1, 172.16.0.1'},
    ):
        key = get_rate_limit_key()
        assert key == '10.0.0.50'  # Should use first IP


def test_rate_limit_key_with_x_real_ip(app):
    """Test rate limiting key falls back to X-Real-IP."""
    with app.test_request_context(
        '/api/lexical', method='POST', headers={'X-Real-IP': '172.16.0.100'}
    ):
        key = get_rate_limit_key()
        assert key == '172.16.0.100'


def test_rate_limit_key_priority(app):
    """Test that X-Forwarded-For takes priority over X-Real-IP."""
    with app.test_request_context(
        '/api/lexical',
        method='POST',
        headers={'X-Forwarded-For': '192.168.1.100', 'X-Real-IP': '172.16.0.100'},
    ):
        key = get_rate_limit_key()
        assert key == '192.168.1.100'  # X-Forwarded-For should win


def test_rate_limit_key_fallback_to_remote_addr(app):
    """Test rate limiting key falls back to remote_addr."""
    with app.test_request_context('/api/lexical', method='POST'):
        key = get_rate_limit_key()
        # Should use request.remote_addr (test client uses 127.0.0.1)
        assert key in ('127.0.0.1', 'unknown')


def test_rate_limit_key_invalid_ip_in_header(app):
    """Test rate limiting key handles invalid IPs in headers."""
    with app.test_request_context(
        '/api/lexical', method='POST', headers={'X-Forwarded-For': 'invalid-ip'}
    ):
        key = get_rate_limit_key()
        # Should fall back to remote_addr or next header
        assert key is not None
        assert key != 'invalid-ip'


def test_rate_limit_key_whitespace_handling(app):
    """Test rate limiting key handles whitespace in headers."""
    with app.test_request_context(
        '/api/lexical', method='POST', headers={'X-Forwarded-For': '  192.168.1.100  '}
    ):
        key = get_rate_limit_key()
        assert key == '192.168.1.100'  # Should strip whitespace
