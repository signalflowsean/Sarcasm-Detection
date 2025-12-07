"""
Model loading and management for sarcasm detection models.
Handles both lexical (text-based) and prosodic (audio-based) models.
"""

import os
import pickle
import logging

from config import LEXICAL_MODEL_PATH, PROSODIC_MODEL_PATH, WAV2VEC_MODEL_NAME

logger = logging.getLogger(__name__)

# ============================================================================
# Model State (module-level singletons)
# ============================================================================

_lexical_model = None
_prosodic_model = None
_wav2vec_processor = None
_wav2vec_model = None
_torch_available = False

# Try to import PyTorch and transformers for prosodic (audio-based) detection.
# Wav2Vec2 converts audio into embeddings that capture prosodic cues (tone, pitch, rhythm).
# Wrapped in try/except for graceful degradation—if not installed, prosodic endpoint returns mock data.
try:
    import torch
    from transformers import Wav2Vec2Processor, Wav2Vec2Model
    _torch_available = True
    logger.info("PyTorch and transformers loaded successfully")
except ImportError as e:
    logger.warning(f"Could not import PyTorch/transformers: {e}")
    logger.warning("Prosodic endpoint will return mock data")


# ============================================================================
# Public API
# ============================================================================

def is_torch_available() -> bool:
    """Check if PyTorch and transformers are available."""
    return _torch_available


def get_lexical_model():
    """Get the loaded lexical model (may be None if not loaded)."""
    return _lexical_model


def get_prosodic_model():
    """Get the loaded prosodic classifier (may be None if not loaded)."""
    return _prosodic_model


def get_wav2vec_components():
    """Get the Wav2Vec2 processor and model (may be None if not loaded)."""
    return _wav2vec_processor, _wav2vec_model


def load_lexical_model() -> bool:
    """
    Load the lexical sarcasm detection model.
    
    Returns:
        bool: True if model loaded successfully, False otherwise.
    """
    global _lexical_model
    
    if _lexical_model is not None:
        return True
    
    if not os.path.exists(LEXICAL_MODEL_PATH):
        logger.warning(f"Could not find lexical model at {LEXICAL_MODEL_PATH}")
        return False
    
    try:
        logger.info(f"Loading lexical model from: {LEXICAL_MODEL_PATH}")
        with open(LEXICAL_MODEL_PATH, 'rb') as f:
            _lexical_model = pickle.load(f)
        logger.info("Lexical model loaded successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to load lexical model: {e}")
        return False


def load_prosodic_models() -> bool:
    """
    Lazy-load prosodic model components.
    Loads both Wav2Vec2 encoder and the prosodic classifier.
    
    Returns:
        bool: True if all models loaded successfully, False otherwise.
    """
    global _prosodic_model, _wav2vec_processor, _wav2vec_model
    
    if not _torch_available:
        return False
    
    # Load Wav2Vec2 encoder
    if _wav2vec_processor is None or _wav2vec_model is None:
        logger.info(f"Loading Wav2Vec2 model: {WAV2VEC_MODEL_NAME}")
        try:
            from transformers import Wav2Vec2Processor, Wav2Vec2Model
            _wav2vec_processor = Wav2Vec2Processor.from_pretrained(WAV2VEC_MODEL_NAME)
            _wav2vec_model = Wav2Vec2Model.from_pretrained(WAV2VEC_MODEL_NAME)
            _wav2vec_model.eval()
            logger.info("Wav2Vec2 model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Wav2Vec2 model: {e}")
            return False
    
    # Load classifier
    if _prosodic_model is None:
        if not os.path.exists(PROSODIC_MODEL_PATH):
            logger.warning(f"Could not find prosodic model at {PROSODIC_MODEL_PATH}")
            return False
        
        try:
            logger.info(f"Loading prosodic classifier from: {PROSODIC_MODEL_PATH}")
            with open(PROSODIC_MODEL_PATH, 'rb') as f:
                _prosodic_model = pickle.load(f)
            logger.info("Prosodic classifier loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load prosodic classifier: {e}")
            return False
    
    return True


# ============================================================================
# Startup Loading
# ============================================================================

# Load lexical model at import time (it's small and fast)
load_lexical_model()

