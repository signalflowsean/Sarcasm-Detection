"""
Pytest configuration and shared fixtures.
"""

import os
import sys

import pytest

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Add project root to path for shared mocks
project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, project_root)

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
