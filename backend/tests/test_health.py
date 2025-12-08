"""
Tests for health check endpoints.
"""

import pytest


def test_health_endpoint_returns_200(client):
    """Health endpoint should return 200 with status info."""
    response = client.get('/api/health')
    
    assert response.status_code == 200
    data = response.get_json()
    
    assert 'status' in data
    assert data['status'] == 'healthy'
    assert 'version' in data
    assert 'models' in data


def test_version_endpoint_returns_200(client):
    """Version endpoint should return 200 with version info."""
    response = client.get('/api/version')
    
    assert response.status_code == 200
    data = response.get_json()
    
    assert 'version' in data
    assert 'buildTime' in data
    assert 'environment' in data

