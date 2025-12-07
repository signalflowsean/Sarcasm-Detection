"""
Inference functions for sarcasm detection models.
"""

import random
import logging
import numpy as np

from .loader import (
    get_lexical_model,
    get_prosodic_model,
    load_prosodic_models,
)

logger = logging.getLogger(__name__)


def lexical_predict(text: str) -> float:
    """
    Predict sarcasm score from text using the lexical model.
    
    Args:
        text: Input text to analyze.
        
    Returns:
        Sarcasm score between 0.0 and 1.0.
        Falls back to random score if model unavailable.
    """
    model = get_lexical_model()
    
    if model is not None:
        try:
            score = float(model.predict_proba([text.strip()])[0][1])
            logger.debug(f"Lexical prediction for '{text[:50]}...': {score:.4f}")
            return score
        except Exception as e:
            logger.error(f"Error during lexical prediction: {e}")
    
    # Fallback to random if model not loaded or error
    return random.random()


def prosodic_predict(embedding: np.ndarray) -> float:
    """
    Predict sarcasm score from audio embedding using the prosodic model.
    
    Args:
        embedding: Wav2Vec2 embedding array of shape (768,).
        
    Returns:
        Sarcasm score between 0.0 and 1.0.
        Falls back to random score if model unavailable.
    """
    # Ensure models are loaded
    models_loaded = load_prosodic_models()
    model = get_prosodic_model()
    
    if models_loaded and model is not None:
        try:
            embedding_2d = embedding.reshape(1, -1)
            score = float(model.predict_proba(embedding_2d)[0, 1])
            logger.debug(f"Prosodic prediction: {score:.4f}")
            return score
        except Exception as e:
            logger.error(f"Error during prosodic prediction: {e}")
    else:
        logger.warning("Prosodic model not available, returning random score")
    
    # Fallback to random if model not loaded or error
    return random.random()

