"""
Inference functions for sarcasm detection models.
"""

import logging

import numpy as np

from .loader import (
    get_lexical_model,
    get_prosodic_model,
    load_lexical_model,
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
        Falls back to neutral 0.5 score if model unavailable.
    """
    # SECURITY: Validate input is string
    if not isinstance(text, str):
        logger.error(f'[LEXICAL MODEL] Invalid input type: {type(text)}, expected str')
        return 0.5, False

    # Ensure model is loaded (consistent with prosodic_predict)
    model_loaded = load_lexical_model()
    model = get_lexical_model()

    if model_loaded and model is not None:
        try:
            # SECURITY: Strip and validate text is not empty
            text = text.strip()
            if not text:
                logger.warning('[LEXICAL MODEL] Empty text after stripping')
                return 0.5, False

            proba = model.predict_proba([text])
            # SECURITY: Validate array shape before indexing to prevent IndexError
            # predict_proba should return shape (n_samples, n_classes) for binary classification
            if proba.shape != (1, 2):
                logger.error(
                    f'[LEXICAL MODEL] Unexpected predict_proba shape: {proba.shape}, expected (1, 2)'
                )
                raise ValueError('Model returned unexpected prediction shape')
            score = float(proba[0][1])
            # SECURITY: Validate score is in valid range [0, 1]
            if not (0.0 <= score <= 1.0):
                logger.error(f'[LEXICAL MODEL] Invalid prediction score: {score}, expected [0, 1]')
                raise ValueError(f'Model returned invalid score: {score}')
            logger.info(f'[LEXICAL MODEL] Prediction: {score:.4f}')
            return score, True
        except (ValueError, IndexError, AttributeError) as e:
            # Expected errors: model interface issues, shape mismatches
            logger.error(f'[LEXICAL MODEL] Model prediction error: {type(e).__name__}: {e}')
        except Exception as e:
            # Unexpected errors: log but don't expose details to prevent information leakage
            logger.error(
                f'[LEXICAL MODEL] Unexpected error during prediction: {type(e).__name__}. '
                'Details logged internally for debugging.'
            )
    else:
        logger.warning('[LEXICAL MODEL] Model not loaded')

    # Fallback to neutral score (0.5 = uncertain) if model not loaded or error
    # Using 0.5 is more honest than random - it indicates "we don't know"
    fallback_score = 0.5
    logger.warning('[LEXICAL FALLBACK] Using neutral fallback score (0.5)')
    return fallback_score, False


def prosodic_predict(embedding: np.ndarray) -> tuple[float, bool]:
    """
    Predict sarcasm score from audio embedding using the prosodic model.

    Args:
        embedding: Wav2Vec2 embedding array of shape (768,).

    Returns:
        tuple: (score between 0.0 and 1.0, is_real_prediction)
        Falls back to neutral 0.5 score if model unavailable.
    """
    # Ensure models are loaded
    models_loaded = load_prosodic_models()
    model = get_prosodic_model()

    if models_loaded and model is not None:
        try:
            # SECURITY: Validate embedding is numpy array
            if not isinstance(embedding, np.ndarray):
                logger.error(
                    f'[PROSODIC MODEL] Invalid embedding type: {type(embedding)}, expected numpy.ndarray'
                )
                raise ValueError('Invalid embedding type')

            # SECURITY: Validate embedding shape before processing
            if embedding.shape != (768,):
                logger.error(
                    f'[PROSODIC MODEL] Invalid embedding shape: {embedding.shape}, expected (768,)'
                )
                raise ValueError('Invalid embedding shape')

            # SECURITY: Ensure embedding is float32 to prevent dtype issues
            if embedding.dtype != np.float32:
                embedding = embedding.astype(np.float32)

            embedding_2d = embedding.reshape(1, -1)
            proba = model.predict_proba(embedding_2d)
            # SECURITY: Validate array shape before indexing to prevent IndexError
            # predict_proba should return shape (n_samples, n_classes) for binary classification
            if proba.shape != (1, 2):
                logger.error(
                    f'[PROSODIC MODEL] Unexpected predict_proba shape: {proba.shape}, expected (1, 2)'
                )
                raise ValueError('Model returned unexpected prediction shape')
            score = float(proba[0, 1])
            # SECURITY: Validate score is in valid range [0, 1]
            if not (0.0 <= score <= 1.0):
                logger.error(f'[PROSODIC MODEL] Invalid prediction score: {score}, expected [0, 1]')
                raise ValueError(f'Model returned invalid score: {score}')
            logger.info(f'[PROSODIC MODEL] Prediction: {score:.4f}')
            return score, True
        except (ValueError, IndexError, AttributeError) as e:
            # Expected errors: model interface issues, shape mismatches
            logger.error(f'[PROSODIC MODEL] Model prediction error: {type(e).__name__}: {e}')
        except Exception as e:
            # Unexpected errors: log but don't expose details to prevent information leakage
            logger.error(
                f'[PROSODIC MODEL] Unexpected error during prediction: {type(e).__name__}. '
                'Details logged internally for debugging.'
            )
    else:
        logger.warning('[PROSODIC MODEL] Model not loaded')

    # Fallback to neutral score (0.5 = uncertain) if model not loaded or error
    # Using 0.5 is more honest than random - it indicates "we don't know"
    fallback_score = 0.5
    logger.warning('[PROSODIC FALLBACK] Using neutral fallback score (0.5)')
    return fallback_score, False
