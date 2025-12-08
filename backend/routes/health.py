"""
Health check and version endpoints for container orchestration.
"""

import os
from datetime import datetime, timezone

from flask import Blueprint, jsonify

from models.loader import get_lexical_model, get_prosodic_model, get_wav2vec_components

bp = Blueprint('health', __name__)

# Version info - update when releasing new versions
API_VERSION = '1.0.0'
# Build time is set at container start (or use current time if not set)
BUILD_TIME = os.environ.get('BUILD_TIME', datetime.now(timezone.utc).isoformat())


@bp.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check endpoint for container orchestration.
    Reports status of loaded models and version info.
    """
    _, wav2vec_model = get_wav2vec_components()

    return jsonify(
        {
            'status': 'healthy',
            'version': API_VERSION,
            'models': {
                'lexical': get_lexical_model() is not None,
                'prosodic': get_prosodic_model() is not None,
                'wav2vec': wav2vec_model is not None,
            },
        }
    )


@bp.route('/api/version', methods=['GET'])
def version():
    """
    Version endpoint - check this in browser console to verify deployment.

    Usage in console:
        fetch('/api/version').then(r => r.json()).then(console.log)
    """
    return jsonify(
        {
            'version': API_VERSION,
            'buildTime': BUILD_TIME,
            'environment': 'production'
            if os.environ.get('FLASK_ENV') != 'development'
            else 'development',
        }
    )
