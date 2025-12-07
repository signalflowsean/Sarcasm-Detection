"""
Flask extensions initialization.
Separates extension instantiation from app creation to avoid circular imports.
"""

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from config import (
    RATE_LIMIT_DEFAULT,
    RATE_LIMIT_STORAGE,
    RATE_LIMIT_ENABLED,
)

# ============================================================================
# Rate Limiter
# ============================================================================
# Protects against abuse - ML inference is computationally expensive.
# Initialized without app, will be attached in create_app() via init_app().

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[RATE_LIMIT_DEFAULT] if RATE_LIMIT_ENABLED else [],
    storage_uri=RATE_LIMIT_STORAGE,
    strategy="fixed-window",  # Simple and predictable
)

