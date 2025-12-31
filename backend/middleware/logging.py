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
        if not request_id:
            # Generate UUID if no request ID provided (for direct API calls)
            request_id = str(uuid.uuid4())

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
        # Calculate request duration
        duration = time.time() - g.start_time
        request_id = g.request_id

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
