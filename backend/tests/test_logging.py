"""
Tests for request/response logging middleware.

Covers:
- Request ID generation and extraction
- Logging output format
- Timing calculations
- Edge cases (missing headers, error scenarios)
"""

import logging
import re
import time
import uuid

import pytest

from middleware.logging import setup_logging_middleware


@pytest.fixture
def test_app():
    """Create a minimal Flask app with logging middleware for testing."""
    from flask import Flask, jsonify

    app = Flask(__name__)
    app.config['TESTING'] = True
    setup_logging_middleware(app)

    @app.route('/test', methods=['GET', 'POST'])
    def test_endpoint():
        return jsonify({'status': 'ok'}), 200

    @app.route('/slow', methods=['GET'])
    def slow_endpoint():
        time.sleep(0.1)  # Simulate slow request
        return jsonify({'status': 'ok'}), 200

    @app.route('/error', methods=['GET'])
    def error_endpoint():
        return jsonify({'error': 'test error'}), 500

    @app.route('/large', methods=['POST'])
    def large_endpoint():
        return jsonify({'data': 'x' * 1000}), 200

    return app


@pytest.fixture
def test_client(test_app):
    """Create test client for the test app."""
    return test_app.test_client()


class TestRequestIDGeneration:
    """Test request ID generation and extraction."""

    def test_generates_request_id_when_header_missing(self, test_client, caplog):
        """Request ID should be generated when X-Request-ID header is missing."""
        with caplog.at_level(logging.INFO):
            response = test_client.get('/test')

        assert response.status_code == 200

        # Check that request log contains a UUID format request ID
        request_logs = [r.message for r in caplog.records if 'GET /test' in r.message]
        assert len(request_logs) > 0

        # Extract request ID from log message
        request_log = request_logs[0]
        # Format: [request_id] GET /test from ...
        match = re.search(r'\[([^\]]+)\]', request_log)
        assert match is not None
        request_id = match.group(1)

        # Verify it's a valid UUID
        try:
            uuid.UUID(request_id)
        except ValueError:
            pytest.fail(f'Generated request ID "{request_id}" is not a valid UUID')

    def test_extracts_request_id_from_header(self, test_client, caplog):
        """Request ID should be extracted from X-Request-ID header when present."""
        custom_request_id = 'test-request-id-12345'

        with caplog.at_level(logging.INFO):
            response = test_client.get('/test', headers={'X-Request-ID': custom_request_id})

        assert response.status_code == 200

        # Check that both request and response logs use the custom request ID
        all_logs = [r.message for r in caplog.records]
        request_logs = [log for log in all_logs if custom_request_id in log]

        assert len(request_logs) >= 2  # At least request and response logs

        # Verify request ID appears in both logs
        for log in request_logs:
            assert f'[{custom_request_id}]' in log

    def test_request_id_consistency_across_logs(self, test_client, caplog):
        """Request ID should be consistent between request and response logs."""
        custom_request_id = 'consistent-id-67890'

        with caplog.at_level(logging.INFO):
            response = test_client.post('/test', json={'data': 'test'})

        assert response.status_code == 200

        # Extract all request IDs from logs
        all_logs = [r.message for r in caplog.records]
        request_id_pattern = r'\[([^\]]+)\]'
        request_ids = set()

        for log in all_logs:
            matches = re.findall(request_id_pattern, log)
            request_ids.update(matches)

        # All logs for this request should use the same request ID
        # (either the custom one or a generated UUID)
        assert len(request_ids) == 1, f'Found multiple request IDs: {request_ids}'


class TestLoggingOutput:
    """Test logging output format and content."""

    def test_request_log_format(self, test_client, caplog):
        """Request log should include method, path, IP, and content length."""
        with caplog.at_level(logging.INFO):
            response = test_client.post(
                '/test',
                json={'data': 'test'},
                headers={'X-Request-ID': 'format-test'},
            )

        assert response.status_code == 200

        # Find request log
        request_logs = [
            r.message
            for r in caplog.records
            if 'format-test' in r.message and 'POST /test' in r.message
        ]
        assert len(request_logs) > 0

        request_log = request_logs[0]

        # Verify log contains required fields
        assert '[format-test]' in request_log
        assert 'POST /test' in request_log
        assert 'from' in request_log
        assert 'Content-Length:' in request_log

    def test_response_log_format(self, test_client, caplog):
        """Response log should include method, path, status, duration, and size."""
        with caplog.at_level(logging.INFO):
            response = test_client.get('/test', headers={'X-Request-ID': 'response-test'})

        assert response.status_code == 200

        # Find response log
        response_logs = [
            r.message
            for r in caplog.records
            if 'response-test' in r.message and 'Status:' in r.message and 'Duration:' in r.message
        ]
        assert len(response_logs) > 0

        response_log = response_logs[0]

        # Verify log contains required fields
        assert '[response-test]' in response_log
        assert 'GET /test' in response_log
        assert 'Status: 200' in response_log
        assert 'Duration:' in response_log
        assert 'Size:' in response_log

    def test_logs_client_ip(self, test_client, caplog):
        """Request log should include client IP address."""
        with caplog.at_level(logging.INFO):
            response = test_client.get('/test')

        assert response.status_code == 200

        # Find request log
        request_logs = [r.message for r in caplog.records if 'GET /test' in r.message]
        assert len(request_logs) > 0

        request_log = request_logs[0]

        # Should contain IP or 'unknown'
        assert 'from' in request_log
        # Extract IP from log: "from <ip>"
        ip_match = re.search(r'from\s+(\S+)', request_log)
        assert ip_match is not None
        ip = ip_match.group(1)
        assert ip in ['127.0.0.1', 'unknown'] or '.' in ip

    def test_logs_content_length(self, test_client, caplog):
        """Request log should include content length."""
        test_data = {'data': 'test content'}
        with caplog.at_level(logging.INFO):
            response = test_client.post('/test', json=test_data)

        assert response.status_code == 200

        # Find request log
        request_logs = [r.message for r in caplog.records if 'POST /test' in r.message]
        assert len(request_logs) > 0

        request_log = request_logs[0]

        # Should contain Content-Length
        assert 'Content-Length:' in request_log
        # Extract content length
        length_match = re.search(r'Content-Length:\s+(\d+)', request_log)
        assert length_match is not None
        content_length = int(length_match.group(1))
        assert content_length >= 0

    def test_logs_response_size(self, test_client, caplog):
        """Response log should include response size."""
        with caplog.at_level(logging.INFO):
            response = test_client.post('/large')

        assert response.status_code == 200

        # Find response log
        response_logs = [
            r.message for r in caplog.records if 'Status: 200' in r.message and 'Size:' in r.message
        ]
        assert len(response_logs) > 0

        response_log = response_logs[0]

        # Should contain Size
        assert 'Size:' in response_log
        # Extract size
        size_match = re.search(r'Size:\s+(\d+)', response_log)
        assert size_match is not None
        size = int(size_match.group(1))
        assert size > 0  # Large endpoint returns data


class TestTimingCalculations:
    """Test request duration calculations."""

    def test_calculates_request_duration(self, test_client, caplog):
        """Response log should include calculated request duration."""
        with caplog.at_level(logging.INFO):
            response = test_client.get('/slow')

        assert response.status_code == 200

        # Find response log
        response_logs = [
            r.message
            for r in caplog.records
            if 'Status: 200' in r.message and 'Duration:' in r.message
        ]
        assert len(response_logs) > 0

        response_log = response_logs[0]

        # Extract duration
        duration_match = re.search(r'Duration:\s+([\d.]+)s', response_log)
        assert duration_match is not None
        duration = float(duration_match.group(1))

        # Should be at least 0.1 seconds (slow endpoint sleeps for 0.1s)
        assert duration >= 0.1
        # Should be reasonable (less than 1 second for a simple request)
        assert duration < 1.0

    def test_duration_format(self, test_client, caplog):
        """Duration should be formatted with 3 decimal places."""
        with caplog.at_level(logging.INFO):
            response = test_client.get('/test')

        assert response.status_code == 200

        # Find response log
        response_logs = [
            r.message
            for r in caplog.records
            if 'Status: 200' in r.message and 'Duration:' in r.message
        ]
        assert len(response_logs) > 0

        response_log = response_logs[0]

        # Duration format should be X.XXXs (3 decimal places)
        duration_match = re.search(r'Duration:\s+([\d.]+)s', response_log)
        assert duration_match is not None
        duration_str = duration_match.group(1)

        # Check format: should have up to 3 decimal places
        parts = duration_str.split('.')
        assert len(parts) == 2  # Should have decimal point
        assert len(parts[1]) <= 3  # Up to 3 decimal places


class TestEdgeCases:
    """Test edge cases and error scenarios."""

    def test_missing_remote_addr(self, test_app, caplog):
        """Should handle missing remote_addr gracefully."""
        with caplog.at_level(logging.INFO):
            with test_app.test_request_context(
                '/test', method='GET', environ_base={'REMOTE_ADDR': None}
            ):
                # Manually trigger before_request
                test_app.preprocess_request()
                # Create a mock response
                from flask import Response

                response = Response('{"status": "ok"}', status=200)
                # Manually trigger after_request
                test_app.process_response(response)

        # Find request log
        request_logs = [r.message for r in caplog.records if 'GET /test' in r.message]
        assert len(request_logs) > 0

        request_log = request_logs[0]

        # Should contain 'unknown' for IP
        assert 'from unknown' in request_log

    def test_missing_content_length(self, test_app, caplog):
        """Should handle missing content_length gracefully."""
        with caplog.at_level(logging.INFO):
            with test_app.test_request_context('/test', method='GET'):
                # Manually trigger before_request
                test_app.preprocess_request()
                # Create a mock response
                from flask import Response

                response = Response('{"status": "ok"}', status=200)
                # Manually trigger after_request
                test_app.process_response(response)

        # Find request log
        request_logs = [r.message for r in caplog.records if 'GET /test' in r.message]
        assert len(request_logs) > 0

        request_log = request_logs[0]

        # Should contain Content-Length: 0 (defaults to 0)
        assert 'Content-Length: 0' in request_log or 'Content-Length: 0 bytes' in request_log

    def test_missing_start_time(self, test_app, caplog):
        """Should handle missing start_time gracefully (before_request failure)."""
        with caplog.at_level(logging.INFO):
            with test_app.test_request_context('/test', method='GET'):
                # Don't call preprocess_request (simulates before_request failure)
                # Create a mock response
                from flask import Response

                response = Response('{"status": "ok"}', status=200)
                # Manually trigger after_request
                test_app.process_response(response)

        # Should log warning about missing start_time
        warning_logs = [
            r.message
            for r in caplog.records
            if r.levelname == 'WARNING' and 'duration unavailable' in r.message.lower()
        ]
        assert len(warning_logs) > 0

        # Find response log
        response_logs = [
            r.message
            for r in caplog.records
            if 'Status: 200' in r.message and 'Duration:' in r.message
        ]
        assert len(response_logs) > 0

        response_log = response_logs[0]

        # Duration should be 0.0 when start_time is missing
        duration_match = re.search(r'Duration:\s+([\d.]+)s', response_log)
        assert duration_match is not None
        duration = float(duration_match.group(1))
        assert duration == 0.0

    def test_missing_response_content_length(self, test_app, caplog):
        """Should handle missing response.content_length gracefully."""
        with caplog.at_level(logging.INFO):
            with test_app.test_request_context('/test', method='GET'):
                # Manually trigger before_request
                test_app.preprocess_request()
                # Create a response without content_length (streaming response)
                from flask import Response

                response = Response('{"status": "ok"}', status=200)
                response.content_length = None  # Simulate streaming response
                # Manually trigger after_request
                test_app.process_response(response)

        # Find response log
        response_logs = [
            r.message for r in caplog.records if 'Status: 200' in r.message and 'Size:' in r.message
        ]
        assert len(response_logs) > 0

        response_log = response_logs[0]

        # Should contain Size: 0 (defaults to 0)
        assert 'Size: 0' in response_log or 'Size: 0 bytes' in response_log

    def test_error_status_code_logging(self, test_client, caplog):
        """Should log error status codes correctly."""
        with caplog.at_level(logging.INFO):
            response = test_client.get('/error')

        assert response.status_code == 500

        # Find response log
        response_logs = [
            r.message
            for r in caplog.records
            if 'Status: 500' in r.message and 'Duration:' in r.message
        ]
        assert len(response_logs) > 0

        response_log = response_logs[0]

        # Should contain error status code
        assert 'Status: 500' in response_log

    def test_request_id_in_error_scenario(self, test_app, caplog):
        """Request ID should be 'unknown' when before_request fails."""
        with caplog.at_level(logging.INFO):
            with test_app.test_request_context('/test', method='GET'):
                # Don't call preprocess_request (simulates before_request failure)
                # Create a mock response
                from flask import Response

                response = Response('{"status": "ok"}', status=200)
                # Manually trigger after_request
                test_app.process_response(response)

        # Find warning log
        warning_logs = [
            r.message
            for r in caplog.records
            if r.levelname == 'WARNING' and 'duration unavailable' in r.message.lower()
        ]
        assert len(warning_logs) > 0

        warning_log = warning_logs[0]

        # Should use 'unknown' as request ID
        assert '[unknown]' in warning_log

    def test_empty_request_id_header(self, test_client, caplog):
        """Should generate new request ID when X-Request-ID header is empty string."""
        with caplog.at_level(logging.INFO):
            response = test_client.get('/test', headers={'X-Request-ID': ''})

        assert response.status_code == 200

        # Find logs
        all_logs = [r.message for r in caplog.records]
        request_logs = [log for log in all_logs if 'GET /test' in log]

        assert len(request_logs) > 0

        # Should not use empty string as request ID
        # Extract request ID from first log
        match = re.search(r'\[([^\]]+)\]', request_logs[0])
        assert match is not None
        request_id = match.group(1)

        # Should be a valid UUID (not empty string)
        assert request_id != ''
        try:
            uuid.UUID(request_id)
        except ValueError:
            pytest.fail(f'Request ID "{request_id}" should be a valid UUID')


class TestMiddlewareRegistration:
    """Test middleware setup and registration."""

    def test_middleware_registers_successfully(self, test_app):
        """Middleware should register without errors."""
        # If we get here without exceptions, registration was successful
        assert test_app is not None

    def test_middleware_logs_registration(self, caplog):
        """Middleware should log successful registration."""
        from flask import Flask

        app = Flask(__name__)
        with caplog.at_level(logging.INFO):
            setup_logging_middleware(app)

        # Check for registration log
        registration_logs = [
            r.message
            for r in caplog.records
            if 'logging middleware registered' in r.message.lower()
        ]
        assert len(registration_logs) > 0
