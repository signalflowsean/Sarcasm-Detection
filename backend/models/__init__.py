"""
Models package for sarcasm detection.
Provides model loading and inference functionality.
"""

from .inference import lexical_predict, prosodic_predict
from .loader import (
    get_lexical_model,
    get_prosodic_model,
    get_wav2vec_components,
    is_torch_available,
    load_lexical_model,
    load_prosodic_models,
)

__all__ = [
    'load_lexical_model',
    'load_prosodic_models',
    'get_lexical_model',
    'get_prosodic_model',
    'get_wav2vec_components',
    'is_torch_available',
    'lexical_predict',
    'prosodic_predict',
]
