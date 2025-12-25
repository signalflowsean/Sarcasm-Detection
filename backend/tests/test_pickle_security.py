"""
Security tests for pickle loading.
Verifies that RestrictedUnpickler correctly blocks malicious pickle files.
"""

import io
import pickle
import tempfile

import pytest

from models.loader import TRUSTED_MODULES, RestrictedUnpickler, secure_load_pickle


def create_malicious_pickle(module_name: str, class_name: str) -> bytes:
    """
    Create a malicious pickle that tries to import an untrusted module.

    Args:
        module_name: Module to try to import (e.g., 'os', 'subprocess')
        class_name: Class to try to instantiate

    Returns:
        Pickle bytes that will attempt to load the untrusted module
    """

    # Create a pickle that references an untrusted module
    class MaliciousClass:
        def __reduce__(self):
            # This will try to import the module during unpickling
            return (getattr(__import__(module_name), class_name), ())

    buffer = io.BytesIO()
    pickle.dump(MaliciousClass(), buffer)
    return buffer.getvalue()


def create_trusted_pickle() -> bytes:
    """Create a safe pickle using only trusted modules."""
    from sklearn.linear_model import LogisticRegression

    # Create a simple sklearn model (trusted)
    model = LogisticRegression()
    model.fit([[1, 2], [3, 4]], [0, 1])

    buffer = io.BytesIO()
    pickle.dump(model, buffer)
    return buffer.getvalue()


def test_restricted_unpickler_blocks_os_module():
    """Test that RestrictedUnpickler blocks pickle files trying to import os."""
    malicious_pickle = create_malicious_pickle('os', 'system')

    buffer = io.BytesIO(malicious_pickle)
    unpickler = RestrictedUnpickler(buffer)

    with pytest.raises(pickle.UnpicklingError, match='Untrusted module blocked'):
        unpickler.load()


def test_restricted_unpickler_blocks_subprocess_module():
    """Test that RestrictedUnpickler blocks pickle files trying to import subprocess."""
    malicious_pickle = create_malicious_pickle('subprocess', 'call')

    buffer = io.BytesIO(malicious_pickle)
    unpickler = RestrictedUnpickler(buffer)

    with pytest.raises(pickle.UnpicklingError, match='Untrusted module blocked'):
        unpickler.load()


def test_restricted_unpickler_blocks_arbitrary_module():
    """Test that RestrictedUnpickler blocks any untrusted module."""
    # Try various dangerous modules
    dangerous_modules = [
        ('os', 'system'),
        ('subprocess', 'call'),
        ('sys', 'exit'),
        ('builtins', 'eval'),  # Even builtins.eval should be blocked (not in TRUSTED_MODULES)
        ('pickle', 'loads'),  # Prevent recursive pickle loading
    ]

    # Python 2-only module (skip on Python 3)
    import sys

    if sys.version_info < (3,):
        dangerous_modules.append(
            ('__builtin__', 'execfile')
        )  # Python 2 compatibility (should be blocked)

    for module_name, class_name in dangerous_modules:
        try:
            malicious_pickle = create_malicious_pickle(module_name, class_name)
        except (ModuleNotFoundError, ImportError):
            # Skip modules that don't exist in this Python version
            continue

        buffer = io.BytesIO(malicious_pickle)
        unpickler = RestrictedUnpickler(buffer)

        with pytest.raises(pickle.UnpicklingError, match='Untrusted module blocked'):
            unpickler.load()


def test_restricted_unpickler_allows_trusted_modules():
    """Test that RestrictedUnpickler allows trusted sklearn modules."""
    trusted_pickle = create_trusted_pickle()

    buffer = io.BytesIO(trusted_pickle)
    unpickler = RestrictedUnpickler(buffer)

    # Should load successfully without raising an error
    model = unpickler.load()
    assert model is not None
    assert hasattr(model, 'predict')


def test_secure_load_pickle_blocks_malicious_file():
    """Test that secure_load_pickle blocks malicious pickle files."""
    malicious_pickle = create_malicious_pickle('os', 'system')

    with tempfile.NamedTemporaryFile(delete=False, suffix='.pkl') as f:
        f.write(malicious_pickle)
        temp_path = f.name

    try:
        with pytest.raises(pickle.UnpicklingError, match='Untrusted module blocked'):
            secure_load_pickle(temp_path)
    finally:
        import os

        os.unlink(temp_path)


def test_secure_load_pickle_allows_trusted_file():
    """Test that secure_load_pickle allows trusted pickle files."""
    trusted_pickle = create_trusted_pickle()

    with tempfile.NamedTemporaryFile(delete=False, suffix='.pkl') as f:
        f.write(trusted_pickle)
        temp_path = f.name

    try:
        model = secure_load_pickle(temp_path)
        assert model is not None
        assert hasattr(model, 'predict')
    finally:
        import os

        os.unlink(temp_path)


def test_trusted_modules_list_is_frozen():
    """Test that TRUSTED_MODULES is immutable (frozenset)."""
    assert isinstance(TRUSTED_MODULES, frozenset)

    # Verify it's actually immutable
    with pytest.raises(AttributeError):
        TRUSTED_MODULES.add('os')  # Should fail - frozenset is immutable


def test_trusted_modules_contains_expected_modules():
    """Test that TRUSTED_MODULES contains expected sklearn modules."""
    expected_modules = [
        'sklearn.pipeline',
        'sklearn.linear_model',
        'sklearn.feature_extraction.text',
        'numpy',
        'scipy.sparse',
        'builtins',
    ]

    for module in expected_modules:
        assert module in TRUSTED_MODULES, f'Expected module {module} not in TRUSTED_MODULES'


def test_trusted_modules_excludes_dangerous_modules():
    """Test that TRUSTED_MODULES excludes dangerous modules."""
    dangerous_modules = [
        'os',
        'subprocess',
        'sys',
        'pickle',
        'eval',
        'exec',
        '__builtin__',
    ]

    for module in dangerous_modules:
        assert module not in TRUSTED_MODULES, f'Dangerous module {module} found in TRUSTED_MODULES'


def test_pickle_with_code_execution_attempt():
    """Test that pickles attempting code execution are blocked."""

    # Create a pickle that tries to execute code via __reduce__
    class CodeExecution:
        def __reduce__(self):
            # This would execute os.system('echo hacked') if allowed
            import os

            return (os.system, ('echo hacked',))

    buffer = io.BytesIO()
    pickle.dump(CodeExecution(), buffer)
    malicious_pickle = buffer.getvalue()

    buffer = io.BytesIO(malicious_pickle)
    unpickler = RestrictedUnpickler(buffer)

    with pytest.raises(pickle.UnpicklingError, match='Untrusted module blocked'):
        unpickler.load()
