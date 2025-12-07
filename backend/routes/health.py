"""
Health check endpoint for container orchestration.
"""

from flask import Blueprint, jsonify

from models.loader import get_lexical_model, get_prosodic_model, get_wav2vec_components

bp = Blueprint('health', __name__)


@bp.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check endpoint for container orchestration.
    Reports status of loaded models.
    """
    _, wav2vec_model = get_wav2vec_components()
    
    return jsonify({
        'status': 'healthy',
        'models': {
            'lexical': get_lexical_model() is not None,
            'prosodic': get_prosodic_model() is not None,
            'wav2vec': wav2vec_model is not None
        }
    })

