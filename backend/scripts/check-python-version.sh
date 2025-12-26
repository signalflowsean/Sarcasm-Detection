#!/bin/bash
# Check if Python 3.11 is available and output the command to use

set -e

PYTHON_CMD=""
if command -v python3.11 &> /dev/null; then
    PYTHON_CMD="python3.11"
elif python3 --version 2>&1 | grep -q "Python 3.11"; then
    PYTHON_CMD="python3"
else
    echo "ERROR: Python 3.11 is required but not found." >&2
    echo "" >&2
    echo "Please install Python 3.11:" >&2
    echo "  - macOS: brew install python@3.11" >&2
    echo "  - Linux: Use your distribution's package manager" >&2
    echo "  - Or use pyenv: pyenv install 3.11" >&2
    echo "" >&2
    echo "Current Python version:" >&2
    python3 --version 2>&1 || echo "Python 3 not found" >&2
    exit 1
fi

# Output version info to stderr (for user visibility)
echo "Using Python: $($PYTHON_CMD --version)" >&2
# Output command to stdout (for command substitution)
echo "$PYTHON_CMD"
