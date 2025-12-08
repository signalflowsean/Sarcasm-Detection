"""
Models package for sarcasm detection.
Provides model loading and inference functionality.
"""

from .inference import lexical_predict, prosodic_predict
from .loader import (
    get_lexical_model,
    get_onnx_session,
    get_prosodic_model,
    is_onnx_available,
    load_lexical_model,
    load_onnx_model,
    load_prosodic_models,
)

__all__ = [
    'load_lexical_model',
    'load_prosodic_models',
    'load_onnx_model',
    'get_lexical_model',
    'get_prosodic_model',
    'get_onnx_session',
    'is_onnx_available',
    'lexical_predict',
    'prosodic_predict',
]
