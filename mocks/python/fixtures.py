"""
Load shared JSON fixtures for Python tests.
"""

import json
from pathlib import Path

_fixtures_dir = Path(__file__).parent.parent / "fixtures"
_api_dir = Path(__file__).parent.parent / "api"


def _load_json(path: Path) -> dict:
    """Load JSON file."""
    with open(path) as f:
        return json.load(f)


# Load test phrases
test_phrases: dict = _load_json(_fixtures_dir / "test-phrases.json")

# Load API responses
api_responses: dict = _load_json(_api_dir / "responses.json")
