"""
Request/Response logging middleware for Flask.

Provides structured logging of all HTTP requests and responses with:
- Request ID tracking (from X-Request-ID header or generated)
- Request details (method, path, client IP, content length)
- Response details (status code, response size)
- Performance metrics (response time in seconds)

The request ID enables correlation between frontend and backend logs for easier debugging.
"""

import logging
import time
import uuid

from flask import Flask, g, request

logger = logging.getLogger(__name__)


def setup_logging_middleware(app: Flask):
    """
    Register request/response logging middleware with Flask app.

    Args:
        app: Flask application instance
    """

    @app.before_request
    def log_request_start():
        """
        Log incoming request details and start timing.

        Extracts or generates request ID for tracking across frontend and backend.
        Stores start time and request ID in Flask's g object for access in after_request.
        """
        # Extract request ID from header or generate new one
        request_id = request.headers.get('X-Request-ID')
        # Check for None, empty string, or whitespace-only strings
        # Explicitly check for empty string to avoid using it as request ID
        if request_id is None or request_id == '' or not request_id.strip():
            # Generate UUID if no valid request ID provided (for direct API calls)
            request_id = str(uuid.uuid4())
        else:
            request_id = request_id.strip()

        # Store in Flask's g object for access across request lifecycle
        g.request_id = request_id
        g.start_time = time.time()

        # Log request details
        content_length = request.content_length or 0
        client_ip = request.remote_addr or 'unknown'

        logger.info(
            f'[{request_id}] {request.method} {request.path} '
            f'from {client_ip} '
            f'Content-Length: {content_length} bytes'
        )

    @app.after_request
    def log_request_end(response):
        """
        Log response details and request duration.

        Args:
            response: Flask response object

        Returns:
            Unmodified response object
        """
        # Safely get request_id and start_time (may not be set if before_request failed)
        request_id = getattr(g, 'request_id', 'unknown')
        start_time = getattr(g, 'start_time', None)

        # Calculate request duration (0 if start_time wasn't set)
        if start_time is not None:
            duration = time.time() - start_time
        else:
            duration = 0.0
            logger.warning(
                f'[{request_id}] Request duration unavailable (before_request may have failed)'
            )

        # Get response size (may be None for streaming responses)
        response_size = response.content_length or 0

        # Log response details
        logger.info(
            f'[{request_id}] {request.method} {request.path} '
            f'- Status: {response.status_code} '
            f'- Duration: {duration:.3f}s '
            f'- Size: {response_size} bytes'
        )

        return response

    logger.info('Request/response logging middleware registered')
