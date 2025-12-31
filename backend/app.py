"""
Flask backend for Sarcasm Detection API.
Provides endpoints for lexical (text-based) and prosodic (audio-based) sarcasm detection.
"""

import traceback

from flask import Flask, jsonify
from flask_cors import CORS

from config import (
    CORS_ORIGINS,
    IS_PRODUCTION,
    PRELOAD_MODELS,
    RATE_LIMIT_DEFAULT,
    RATE_LIMIT_ENABLED,
    logger,
)
from errors import UserError
from extensions import limiter
from middleware.logging import setup_logging_middleware
from routes import health_bp, lexical_bp, prosodic_bp


def preload_models():
    """
    Preload ML models at startup to avoid timeout on first request.
    Wav2Vec2 is ~360MB and takes 20-30s to download on first load.

    Errors during model loading are logged but do not prevent app startup.
    Models will be loaded on first request if preloading fails.
    """
    from models.loader import load_lexical_model, load_prosodic_models

    logger.info('Preloading ML models...')

    # Lexical model is small and fast
    try:
        if load_lexical_model():
            logger.info('Lexical model preloaded successfully')
        else:
            logger.warning('Lexical model failed to preload - will retry on first request')
    except Exception as e:
        # Don't let model loading errors prevent app startup
        logger.error(f'[STARTUP ERROR] Failed to preload lexical model: {e}')
        logger.warning('App will start without preloaded models - will load on first request')

    # Prosodic model includes Wav2Vec2 (~360MB) - this takes time
    try:
        logger.info('Loading Wav2Vec2 model (this may take 20-30 seconds on first run)...')
        if load_prosodic_models():
            logger.info('All models preloaded successfully!')
        else:
            logger.warning('Prosodic models failed to preload - will retry on first request')
    except Exception as e:
        # Don't let model loading errors prevent app startup
        logger.error(f'[STARTUP ERROR] Failed to preload prosodic models: {e}')
        logger.warning('App will start without preloaded models - will load on first request')


def create_app():
    """
    Flask application factory.
    Creates and configures the Flask app with CORS, rate limiting, and routes.
    """
    app = Flask(__name__)

    # CORS configuration: restrict origins in production
    if IS_PRODUCTION:
        # CRITICAL: CORS_ORIGINS can be None if validation failed - handle this case
        if not CORS_ORIGINS or CORS_ORIGINS == '*':
            error_msg = (
                'CORS_ORIGINS must be explicitly set in production. '
                'Set the CORS_ORIGINS environment variable to a comma-separated list of allowed origins.'
            )
            logger.error(f'[SECURITY] {error_msg}')
            raise ValueError(error_msg)

        # Security check: warn if using localhost in production (common mistake)
        cors_origins_list = [origin.strip() for origin in CORS_ORIGINS.split(',')]
        localhost_origins = [
            origin
            for origin in cors_origins_list
            if 'localhost' in origin.lower() or origin.startswith('http://')
        ]

        if localhost_origins:
            logger.warning(
                f'[SECURITY WARNING] CORS_ORIGINS contains localhost or HTTP-only origins: {localhost_origins}. '
                'This is unsafe for production. Use HTTPS URLs of your actual domain(s) instead.'
            )

        CORS(app, origins=cors_origins_list)  # Restrict to specified origins
        logger.info(f'CORS restricted to origins: {CORS_ORIGINS}')
    else:
        # Development: allow all origins for convenience
        CORS(app)  # Allow all origins (development)
        logger.info('CORS enabled for all origins (development mode)')

    # Initialize rate limiter with this app
    limiter.init_app(app)

    if RATE_LIMIT_ENABLED:
        logger.info(f'Rate limiting enabled: {RATE_LIMIT_DEFAULT} (default)')
    else:
        logger.info('Rate limiting disabled')

    # Register request/response logging middleware
    setup_logging_middleware(app)

    # Custom error handler for rate limit exceeded
    @app.errorhandler(429)
    def rate_limit_exceeded(e):
        # Log detailed rate limit info internally
        logger.warning(f'[RATE LIMIT] Request blocked: {e.description}')
        # Return sanitized message to user (don't expose internal details)
        return jsonify({'error': UserError.RATE_LIMITED}), 429

    # Generic error handler for uncaught exceptions
    # SECURITY: Always register 500 handler to prevent information disclosure
    # In development, Flask's default debug error page can leak sensitive info
    @app.errorhandler(500)
    def internal_error(e):
        # Log detailed error internally (includes full traceback in development)
        if IS_PRODUCTION:
            logger.error(f'[INTERNAL ERROR] Uncaught exception: {e}')
        else:
            # In development, log full exception details for debugging
            logger.error(f'[INTERNAL ERROR] Uncaught exception: {e}\n{traceback.format_exc()}')
        # Always return sanitized message to user (never expose stack traces)
        return jsonify({'error': UserError.INTERNAL_ERROR}), 500

    # Register blueprints
    app.register_blueprint(lexical_bp)
    app.register_blueprint(prosodic_bp)
    app.register_blueprint(health_bp)

    return app


# Preload models before creating app (happens once with gunicorn --preload)
# Only preload if explicitly enabled (defaults to True for production)
# Set PRELOAD_MODELS=false to disable for faster development startup
if PRELOAD_MODELS:
    preload_models()
else:
    logger.info(
        'Model preloading disabled (PRELOAD_MODELS=false). Models will load on first request.'
    )

# Create the app instance
app = create_app()


if __name__ == '__main__':
    # Only used for local development (production uses gunicorn via Dockerfile)
    debug_mode = not IS_PRODUCTION
    logger.info(f'Starting Flask app in {"production" if IS_PRODUCTION else "development"} mode')
    app.run(host='0.0.0.0', port=5000, debug=debug_mode)
