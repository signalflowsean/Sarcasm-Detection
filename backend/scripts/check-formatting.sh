#!/bin/bash
# Diagnostic script to check ruff formatting consistency
# Usage: ./scripts/check-formatting.sh

set -e

echo "=== Ruff Formatting Diagnostics ==="
echo ""

echo "1. Checking ruff version..."
INSTALLED_VERSION=$(ruff --version | awk '{print $2}')
echo "Installed: $INSTALLED_VERSION"

# Get expected version from requirements-dev.txt
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REQUIREMENTS_FILE="$SCRIPT_DIR/../requirements-dev.txt"
if [ -f "$REQUIREMENTS_FILE" ]; then
    EXPECTED_VERSION=$(grep "^ruff==" "$REQUIREMENTS_FILE" | cut -d'=' -f3)
    echo "Expected: $EXPECTED_VERSION"
    if [ "$INSTALLED_VERSION" != "$EXPECTED_VERSION" ]; then
        echo "⚠️  WARNING: Version mismatch! Install correct version with:"
        echo "   pip install ruff==$EXPECTED_VERSION"
    else
        echo "✓ Version matches requirements-dev.txt"
    fi
else
    echo "⚠️  Could not find requirements-dev.txt"
fi
echo ""

echo "2. Checking pre-commit ruff version..."
grep -A 2 "ruff-pre-commit" ../.pre-commit-config.yaml | grep "rev:" || echo "Not found"
echo ""

echo "3. Checking if all files are formatted..."
cd "$(dirname "$0")/.."
if ruff format --check . > /tmp/ruff-format-check.txt 2>&1; then
    echo "✓ All files are properly formatted"
else
    echo "✗ Some files need formatting:"
    cat /tmp/ruff-format-check.txt
    echo ""
    echo "Files that need formatting:"
    ruff format --check . 2>&1 | grep "Would reformat" || true
fi
echo ""

echo "4. Checking for uncommitted formatting changes..."
if git diff --quiet backend/tests/test_rate_limiting.py 2>/dev/null; then
    echo "✓ test_rate_limiting.py is committed"
else
    echo "✗ test_rate_limiting.py has uncommitted changes:"
    git diff backend/tests/test_rate_limiting.py
fi
echo ""

echo "=== Diagnostics Complete ==="
