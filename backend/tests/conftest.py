"""
Pytest configuration and shared fixtures.

Path Setup
----------
This file modifies sys.path to enable imports across the monorepo:

1. Backend directory: Allows `from routes import ...`, `from models import ...`
2. Project root: Allows `from mocks.python import ...` for shared test utilities

This is necessary because:
- The backend is not installed as a package (no setup.py/pyproject.toml with [project])
- The mocks directory is at the project root, outside the backend package
- pytest runs from backend/, so relative imports don't reach mocks/

Alternative approaches considered:
- Using pip install -e . : Would require restructuring as installable packages
- PYTHONPATH env var: Less portable across dev environments
- conftest.py path setup: Chosen for simplicity and pytest's guaranteed early execution

The path modifications happen before any test imports, so modules like
`backend/tests/mocks.py` can safely import from `mocks.python`.
"""

import os
import sys

import pytest

# Add backend directory to path for app module imports
# This allows: from routes import ..., from models import ..., etc.
_backend_dir = os.path.dirname(os.path.dirname(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# Add project root to path for shared mocks
# This allows: from mocks.python import create_mock_wav, MockLexicalModel
_project_root = os.path.dirname(_backend_dir)
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

# Set test environment BEFORE importing app modules
os.environ['FLASK_ENV'] = 'testing'
os.environ['RATE_LIMIT_ENABLED'] = 'false'
os.environ['API_DELAY_SECONDS'] = '0'


@pytest.fixture
def app():
    """Create test Flask application."""
    # Import here after environment is set
    from app import create_app

    test_app = create_app()
    test_app.config['TESTING'] = True

    yield test_app


@pytest.fixture
def client(app):
    """Create test client for making requests."""
    return app.test_client()
