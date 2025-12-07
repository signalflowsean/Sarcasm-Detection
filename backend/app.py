"""
Flask backend for Sarcasm Detection API.
Provides endpoints for lexical (text-based) and prosodic (audio-based) sarcasm detection.
"""

from flask import Flask
from flask_cors import CORS

from config import CORS_ORIGINS, IS_PRODUCTION, logger
from routes import lexical_bp, prosodic_bp, health_bp


def create_app():
    """
    Flask application factory.
    Creates and configures the Flask app with CORS and routes.
    """
    app = Flask(__name__)
    
    # CORS configuration: restrict origins in production
    if CORS_ORIGINS == '*':
        CORS(app)  # Allow all origins (development)
    else:
        CORS(app, origins=CORS_ORIGINS.split(','))  # Restrict to specified origins
    
    # Register blueprints
    app.register_blueprint(lexical_bp)
    app.register_blueprint(prosodic_bp)
    app.register_blueprint(health_bp)
    
    return app


# Create the app instance
app = create_app()


if __name__ == '__main__':
    # Only used for local development (production uses gunicorn via Dockerfile)
    debug_mode = not IS_PRODUCTION
    logger.info(f"Starting Flask app in {'production' if IS_PRODUCTION else 'development'} mode")
    app.run(host='0.0.0.0', port=5000, debug=debug_mode)
