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


def lexical_predict(text: str) -> tuple[float, bool]:
    """
    Predict sarcasm score from text using the lexical model.
    
    Args:
        text: Input text to analyze.
        
    Returns:
        tuple: (score between 0.0 and 1.0, is_real_prediction)
        Falls back to random score if model unavailable.
    """
    model = get_lexical_model()
    
    if model is not None:
        try:
            score = float(model.predict_proba([text.strip()])[0][1])
            logger.info(f"[LEXICAL MODEL] Prediction: {score:.4f}")
            return score, True
        except Exception as e:
            logger.error(f"[LEXICAL MODEL] Error during prediction: {e}")
    else:
        logger.warning("[LEXICAL MODEL] Model not loaded")
    
    # Fallback to random if model not loaded or error
    fallback_score = random.random()
    logger.warning(f"[LEXICAL FALLBACK] Using random score: {fallback_score:.4f}")
    return fallback_score, False


def prosodic_predict(embedding: np.ndarray) -> tuple[float, bool]:
    """
    Predict sarcasm score from audio embedding using the prosodic model.
    
    Args:
        embedding: Wav2Vec2 embedding array of shape (768,).
        
    Returns:
        tuple: (score between 0.0 and 1.0, is_real_prediction)
        Falls back to random score if model unavailable.
    """
    # Ensure models are loaded
    models_loaded = load_prosodic_models()
    model = get_prosodic_model()
    
    if models_loaded and model is not None:
        try:
            embedding_2d = embedding.reshape(1, -1)
            score = float(model.predict_proba(embedding_2d)[0, 1])
            logger.info(f"[PROSODIC MODEL] Prediction: {score:.4f}")
            return score, True
        except Exception as e:
            logger.error(f"[PROSODIC MODEL] Error during prediction: {e}")
    else:
        logger.warning("[PROSODIC MODEL] Model not loaded")
    
    # Fallback to random if model not loaded or error
    fallback_score = random.random()
    logger.warning(f"[PROSODIC FALLBACK] Using random score: {fallback_score:.4f}")
    return fallback_score, False

