"""
Routes package for Sarcasm Detection API.
Contains Flask Blueprints for each endpoint group.
"""

from .lexical import bp as lexical_bp
from .prosodic import bp as prosodic_bp
from .health import bp as health_bp

__all__ = ['lexical_bp', 'prosodic_bp', 'health_bp']

