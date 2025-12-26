"""
Health check and version endpoints for container orchestration.
"""

import logging
import os
from datetime import datetime, timezone

from flask import Blueprint, jsonify

from models.loader import get_lexical_model, get_onnx_session, get_prosodic_model

bp = Blueprint('health', __name__)
logger = logging.getLogger(__name__)

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
    # SECURITY: Wrap model checks in try-except to prevent health check failures
    # from crashing the endpoint if model loading functions raise exceptions
    try:
        lexical_loaded = get_lexical_model() is not None
    except Exception as e:
        logger.error(f'[HEALTH] Error checking lexical model: {type(e).__name__}: {e}')
        lexical_loaded = False

    try:
        prosodic_loaded = get_prosodic_model() is not None
    except Exception as e:
        logger.error(f'[HEALTH] Error checking prosodic model: {type(e).__name__}: {e}')
        prosodic_loaded = False

    try:
        onnx_loaded = get_onnx_session() is not None
    except Exception as e:
        logger.error(f'[HEALTH] Error checking ONNX session: {type(e).__name__}: {e}')
        onnx_loaded = False

    return jsonify(
        {
            'status': 'healthy',
            'version': API_VERSION,
            'models': {
                'lexical': lexical_loaded,
                'prosodic': prosodic_loaded,
                'wav2vec_onnx': onnx_loaded,
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
