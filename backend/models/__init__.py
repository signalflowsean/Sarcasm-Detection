"""
Models package for sarcasm detection.
Provides model loading and inference functionality.
"""

from .loader import (
    load_lexical_model,
    load_prosodic_models,
    get_lexical_model,
    get_prosodic_model,
    get_wav2vec_components,
    is_torch_available,
)
from .inference import lexical_predict, prosodic_predict

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

