"""
Security tests for audio processing module.
Tests path validation and command injection prevention.
"""

import os
import tempfile

import pytest

from audio.processing import _validate_path_in_directory


def test_validate_path_valid():
    """Test that valid paths within directory are accepted."""
    with tempfile.TemporaryDirectory() as tmpdir:
        valid_path = os.path.join(tmpdir, 'test.txt')
        resolved = _validate_path_in_directory(valid_path, tmpdir)
        assert resolved.startswith(os.path.realpath(tmpdir))


def test_validate_path_traversal_detected():
    """Test that path traversal attempts are rejected."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Attempt path traversal
        malicious_path = os.path.join(tmpdir, '..', 'etc', 'passwd')

        with pytest.raises(ValueError, match='path traversal'):
            _validate_path_in_directory(malicious_path, tmpdir)


def test_validate_path_outside_directory():
    """Test that paths outside base directory are rejected."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Path outside temp directory
        outside_path = '/etc/passwd'

        with pytest.raises(ValueError, match='path traversal'):
            _validate_path_in_directory(outside_path, tmpdir)


def test_validate_path_symlink_resolution():
    """Test that symlinks are resolved correctly."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create a file
        real_file = os.path.join(tmpdir, 'real_file.txt')
        with open(real_file, 'w') as f:
            f.write('test')

        # Create symlink
        symlink = os.path.join(tmpdir, 'symlink')
        os.symlink(real_file, symlink)

        # Should resolve symlink and validate correctly
        resolved = _validate_path_in_directory(symlink, tmpdir)
        assert resolved == os.path.realpath(real_file)


def test_validate_path_nested_directories():
    """Test that nested directories within temp dir are valid."""
    with tempfile.TemporaryDirectory() as tmpdir:
        nested_dir = os.path.join(tmpdir, 'nested', 'subdir', 'file.txt')
        os.makedirs(os.path.dirname(nested_dir), exist_ok=True)

        resolved = _validate_path_in_directory(nested_dir, tmpdir)
        assert resolved.startswith(os.path.realpath(tmpdir))


def test_validate_path_legitimate_double_dots():
    """Test that legitimate filenames with consecutive dots are accepted."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Legitimate filename with consecutive dots (not path traversal)
        valid_path = os.path.join(tmpdir, 'my..file.txt')

        # Should not raise an error - consecutive dots in filename are valid
        resolved = _validate_path_in_directory(valid_path, tmpdir)
        assert resolved.startswith(os.path.realpath(tmpdir))

        # Test with multiple consecutive dots
        valid_path2 = os.path.join(tmpdir, 'file...with...dots.txt')
        resolved2 = _validate_path_in_directory(valid_path2, tmpdir)
        assert resolved2.startswith(os.path.realpath(tmpdir))
