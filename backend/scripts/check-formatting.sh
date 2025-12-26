#!/bin/bash
# Diagnostic script to check ruff formatting consistency
# Usage: ./scripts/check-formatting.sh

set -e

echo "=== Ruff Formatting Diagnostics ==="
echo ""

echo "1. Checking ruff version..."
ruff --version
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
