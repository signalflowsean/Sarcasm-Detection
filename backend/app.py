"""
Flask backend for Sarcasm Detection API.
Provides endpoints for lexical (text-based) and prosodic (audio-based) sarcasm detection.
"""

from flask import Flask, jsonify
from flask_cors import CORS

from config import (
    CORS_ORIGINS, 
    IS_PRODUCTION, 
    logger,
    RATE_LIMIT_DEFAULT,
    RATE_LIMIT_ENABLED,
)
from extensions import limiter
from routes import lexical_bp, prosodic_bp, health_bp
from errors import UserError


def preload_models():
    """
    Preload ML models at startup to avoid timeout on first request.
    Wav2Vec2 is ~360MB and takes 20-30s to download on first load.
    """
    from models.loader import load_lexical_model, load_prosodic_models
    
    logger.info("Preloading ML models...")
    
    # Lexical model is small and fast
    load_lexical_model()
    
    # Prosodic model includes Wav2Vec2 (~360MB) - this takes time
    logger.info("Loading Wav2Vec2 model (this may take 20-30 seconds on first run)...")
    if load_prosodic_models():
        logger.info("All models preloaded successfully!")
    else:
        logger.warning("Prosodic models failed to preload - will retry on first request")


def create_app():
    """
    Flask application factory.
    Creates and configures the Flask app with CORS, rate limiting, and routes.
    """
    app = Flask(__name__)
    
    # CORS configuration: restrict origins in production
    if CORS_ORIGINS == '*':
        CORS(app)  # Allow all origins (development)
    else:
        CORS(app, origins=CORS_ORIGINS.split(','))  # Restrict to specified origins
    
    # Initialize rate limiter with this app
    limiter.init_app(app)
    
    if RATE_LIMIT_ENABLED:
        logger.info(f"Rate limiting enabled: {RATE_LIMIT_DEFAULT} (default)")
    else:
        logger.info("Rate limiting disabled")
    
    # Custom error handler for rate limit exceeded
    @app.errorhandler(429)
    def rate_limit_exceeded(e):
        # Log detailed rate limit info internally
        logger.warning(f"[RATE LIMIT] Request blocked: {e.description}")
        # Return sanitized message to user (don't expose internal details)
        return jsonify({
            'error': UserError.RATE_LIMITED
        }), 429
    
    # Generic error handler for uncaught exceptions (production only)
    if IS_PRODUCTION:
        @app.errorhandler(500)
        def internal_error(e):
            # Log detailed error internally
            logger.error(f"[INTERNAL ERROR] Uncaught exception: {e}")
            # Return sanitized message to user
            return jsonify({
                'error': UserError.INTERNAL_ERROR
            }), 500
    
    # Register blueprints
    app.register_blueprint(lexical_bp)
    app.register_blueprint(prosodic_bp)
    app.register_blueprint(health_bp)
    
    return app


# Preload models before creating app (happens once with gunicorn --preload)
preload_models()

# Create the app instance
app = create_app()


if __name__ == '__main__':
    # Only used for local development (production uses gunicorn via Dockerfile)
    debug_mode = not IS_PRODUCTION
    logger.info(f"Starting Flask app in {'production' if IS_PRODUCTION else 'development'} mode")
    app.run(host='0.0.0.0', port=5000, debug=debug_mode)
