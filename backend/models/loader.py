"""
Model loading and management for sarcasm detection models.
Handles both lexical (text-based) and prosodic (audio-based) models.

Security: Uses RestrictedUnpickler to only allow trusted scikit-learn and numpy
classes during deserialization, preventing arbitrary code execution from malicious
pickle files.

Lock Ordering: Implements runtime lock ordering validation to prevent deadlock.
See docs/LOCK_ORDERING.md for details on the lock hierarchy and usage patterns.

Future Considerations:
    - Consider using joblib for model serialization (safer than pickle, designed for sklearn)
    - Consider ONNX format for cross-platform model deployment (already used for Wav2Vec2)
    - When retraining models, prefer joblib.dump() over pickle.dump() for better security
    - See: https://scikit-learn.org/stable/modules/model_persistence.html#security-maintainability-limitations
"""

import logging
import os
import pickle
import threading
from contextlib import contextmanager

from config import FLASK_ENV, LEXICAL_MODEL_PATH, PROSODIC_MODEL_PATH

logger = logging.getLogger(__name__)

# ONNX model path (same directory as other models)
ONNX_MODEL_PATH = os.path.join(os.path.dirname(PROSODIC_MODEL_PATH), 'wav2vec2.onnx')


# ============================================================================
# Secure Pickle Loading (RestrictedUnpickler)
# ============================================================================
#
# pickle.load() is dangerous because it can execute arbitrary code during
# deserialization. This RestrictedUnpickler only allows specific trusted
# modules and classes needed for scikit-learn models.
#
# Allowed modules:
#   - sklearn.* (scikit-learn pipeline, vectorizers, classifiers)
#   - numpy (arrays used by sklearn)
#   - scipy.sparse (sparse matrices)
#   - builtins (basic Python types: dict, list, tuple, etc.)
# ============================================================================

# Allowlist of trusted modules for model loading
# SECURITY: Only explicitly listed modules are allowed - no wildcards or prefixes.
# If a new sklearn module is needed, add it here after security review.
#
# Documentation for each module group:
TRUSTED_MODULES = frozenset(
    [
        # -------------------------------------------------------------------------
        # scikit-learn modules (explicitly enumerated for security)
        # -------------------------------------------------------------------------
        # Core pipeline - Required for Pipeline objects that chain transformers/estimators
        'sklearn.pipeline',  # Pipeline class (TF-IDF -> LogisticRegression)
        'sklearn._config',  # Global sklearn configuration
        'sklearn.base',  # Base classes (BaseEstimator, TransformerMixin)
        # Feature extraction (TF-IDF) - Used by lexical model for text vectorization
        'sklearn.feature_extraction.text',  # TfidfVectorizer class
        'sklearn.feature_extraction._hash',  # HashingVectorizer internals
        'sklearn.feature_extraction._stop_words',  # Stop word lists
        # Linear models (LogisticRegression) - Primary classifier for both models
        'sklearn.linear_model',  # LogisticRegression class
        'sklearn.linear_model._logistic',  # LogisticRegression implementation
        'sklearn.linear_model._base',  # Base linear model classes
        # SVM (LinearSVC) - Used in ensemble models (if any)
        'sklearn.svm',  # Support Vector Machine classes
        'sklearn.svm._base',  # Base SVM classes
        'sklearn.svm._classes',  # SVM classifier implementations
        # Ensemble models - Used if models use VotingClassifier or similar
        'sklearn.ensemble',  # Ensemble meta-estimators
        'sklearn.ensemble._voting',  # VotingClassifier
        'sklearn.ensemble._base',  # Base ensemble classes
        'sklearn.ensemble._forest',  # RandomForest (if used)
        'sklearn.ensemble._gb',  # GradientBoosting (if used)
        # Calibration - Used if models use CalibratedClassifierCV
        'sklearn.calibration',  # Probability calibration
        # Naive Bayes - Alternative classifier (if used)
        'sklearn.naive_bayes',  # Naive Bayes classifiers
        # Preprocessing (StandardScaler) - Used by prosodic model for feature scaling
        'sklearn.preprocessing',  # StandardScaler, MinMaxScaler, etc.
        'sklearn.preprocessing._data',  # Data preprocessing implementations
        'sklearn.preprocessing._label',  # Label preprocessing
        # Utils (internal helpers) - Required for sklearn internals
        'sklearn.utils',  # Utility functions
        'sklearn.utils._bunch',  # Bunch class (dict-like object)
        'sklearn.utils._tags',  # Model tags/metadata
        'sklearn.utils._param_validation',  # Parameter validation
        'sklearn.utils.metadata_routing',  # Metadata routing (sklearn 1.3+)
        # -------------------------------------------------------------------------
        # numpy (required by sklearn for arrays)
        # -------------------------------------------------------------------------
        # All numpy modules needed for array serialization/deserialization
        'numpy',  # Main numpy module
        'numpy.core',  # Core numpy functionality
        'numpy.core.multiarray',  # Multi-dimensional arrays
        'numpy.core.numeric',  # Numeric operations
        'numpy._core',  # New numpy core (numpy 2.0+)
        'numpy._core.multiarray',  # New multiarray (numpy 2.0+)
        'numpy.dtypes',  # Data types
        'numpy.random',  # Random number generation (used by sklearn)
        'numpy.random._pickle',  # Random state pickling
        # -------------------------------------------------------------------------
        # scipy sparse matrices (used by TF-IDF vectorizer)
        # -------------------------------------------------------------------------
        # TF-IDF returns sparse matrices (CSR format) for memory efficiency
        'scipy.sparse',  # Sparse matrix base classes
        'scipy.sparse._csr',  # Compressed Sparse Row format
        'scipy.sparse._csc',  # Compressed Sparse Column format
        'scipy.sparse._arrays',  # Sparse array implementations
        'scipy.sparse._matrix',  # Sparse matrix base
        # -------------------------------------------------------------------------
        # Python builtins (safe types: dict, list, tuple, set, etc.)
        # -------------------------------------------------------------------------
        # Required for basic Python data structures in pickle files
        'builtins',  # Built-in types (dict, list, tuple, set, str, int, float, etc.)
        'collections',  # Collections (OrderedDict, defaultdict, etc.)
        'copy_reg',  # Pickle reconstructors (Python 2 compatibility)
        '_codecs',  # Codec registry (for string encoding)
    ]
)

# Blocklist of dangerous class names that should never be loaded, even from trusted modules
# SECURITY: These functions can execute arbitrary code and must be blocked
BLOCKED_CLASS_NAMES = frozenset(
    [
        'eval',  # Can execute arbitrary Python code
        'exec',  # Can execute arbitrary Python code
        'execfile',  # Can execute arbitrary Python files (Python 2)
        'compile',  # Can compile arbitrary code
        '__import__',  # Can import arbitrary modules
        'open',  # Can open arbitrary files (though we allow it for basic file operations)
        'file',  # Python 2 file type
        'input',  # Can read from stdin
        'raw_input',  # Python 2 input function
        'reload',  # Can reload modules
        'exit',  # Can exit the process
        'quit',  # Can exit the process
        'loads',  # Can unpickle arbitrary data (recursive pickle loading)
        'load',  # Can unpickle arbitrary data (recursive pickle loading)
    ]
)


class RestrictedUnpickler(pickle.Unpickler):
    """
    A restricted unpickler that only allows trusted modules.

    This prevents arbitrary code execution from malicious pickle files by
    refusing to load classes from untrusted modules.
    """

    def find_class(self, module: str, name: str):
        """
        Override find_class to restrict which classes can be loaded.

        Args:
            module: The module name (e.g., 'sklearn.pipeline')
            name: The class name (e.g., 'Pipeline')

        Returns:
            The class object if trusted

        Raises:
            pickle.UnpicklingError: If module is not in the allowlist or class is blocked
        """
        # SECURITY: Block dangerous class names even from trusted modules
        if name in BLOCKED_CLASS_NAMES:
            logger.error(
                f'[SECURITY] Blocked dangerous class during unpickling: {module}.{name}. '
                'This class can execute arbitrary code and is not safe for model loading.'
            )
            raise pickle.UnpicklingError(
                f'Untrusted module blocked: {module}.{name}. Model file may be corrupted or malicious.'
            )

        # SECURITY: Only allow explicitly listed modules - no wildcards or prefix matching
        if module in TRUSTED_MODULES:
            return super().find_class(module, name)

        # Reject untrusted modules with detailed logging for debugging
        logger.error(
            f'[SECURITY] Blocked untrusted module during unpickling: {module}.{name}. '
            'If this is a legitimate sklearn module needed for your model, '
            'add it to TRUSTED_MODULES in models/loader.py after security review.'
        )
        raise pickle.UnpicklingError(
            f'Untrusted module blocked: {module}.{name}. Model file may be corrupted or malicious.'
        )


def secure_load_pickle(filepath: str, skip_path_validation: bool = False):
    """
    Securely load a pickle file using RestrictedUnpickler.

    Args:
        filepath: Path to the pickle file
        skip_path_validation: If True, skip path validation (for testing only)

    Returns:
        The unpickled object

    Raises:
        pickle.UnpicklingError: If untrusted classes are found
        FileNotFoundError: If file doesn't exist
        ValueError: If filepath is invalid or contains path traversal
    """
    # SECURITY: Validate filepath before opening to prevent path traversal
    if not filepath or not isinstance(filepath, str):
        raise ValueError('Invalid filepath: must be a non-empty string')

    # Skip path validation if explicitly requested (for testing)
    if not skip_path_validation:
        # SECURITY: Check for path traversal attempts and validate absolute paths
        # Check for actual path traversal patterns: /../, ../ at start, ..\ (Windows), or standalone ..
        # This allows legitimate filenames containing .. (e.g., "my..file.txt")
        if (
            '/../' in filepath
            or filepath.startswith('../')
            or filepath.startswith('..\\')
            or '\\..\\' in filepath
            or filepath == '..'
        ):
            logger.error(f'[SECURITY] Blocked path traversal attempt: {filepath}')
            raise ValueError('Invalid filepath: path traversal detected')

        # For absolute paths, validate they're within expected model directory
        # This prevents loading arbitrary files from the filesystem
        if os.path.isabs(filepath):
            resolved_path = os.path.realpath(filepath)
            expected_dir = os.path.realpath(os.path.dirname(PROSODIC_MODEL_PATH))

            # Use os.path.commonpath() for robust path validation
            # This properly handles all edge cases including:
            # - Files within subdirectories: /models/subdir/file.pkl
            # - Files at root of models dir: /models/file.pkl
            # - Path traversal attempts: /models/../etc/passwd
            try:
                common = os.path.commonpath([resolved_path, expected_dir])
                if common != expected_dir:
                    logger.error(
                        f'[SECURITY] Blocked absolute path outside model directory: {filepath} '
                        f'(resolved: {resolved_path}, expected dir: {expected_dir})'
                    )
                    raise ValueError('Invalid filepath: path outside allowed directory')
            except ValueError as e:
                # commonpath raises ValueError if paths are on different drives (Windows)
                logger.error(
                    f'[SECURITY] Blocked absolute path on different drive: {filepath} '
                    f'(resolved: {resolved_path}, expected dir: {expected_dir})'
                )
                raise ValueError('Invalid filepath: path outside allowed directory') from e

    # Context manager ensures file is closed even if exception occurs during unpickling
    try:
        with open(filepath, 'rb') as f:
            return RestrictedUnpickler(f).load()
    except FileNotFoundError:
        logger.error(f'[SECURITY] Model file not found: {filepath}')
        raise
    except OSError as e:
        logger.error(f'[SECURITY] Failed to open model file: {filepath}, error: {e}')
        raise ValueError(f'Failed to open model file: {e}') from e


def validate_sklearn_model(model, model_name: str) -> bool:
    """
    Validate that a loaded model is a valid scikit-learn model with expected interface.

    Args:
        model: The loaded model object
        model_name: Name for logging purposes

    Returns:
        True if valid, False otherwise
    """
    # Check for required sklearn interface
    if not hasattr(model, 'predict_proba'):
        logger.error(f'[SECURITY] {model_name} missing predict_proba method')
        return False

    if not hasattr(model, 'predict'):
        logger.error(f'[SECURITY] {model_name} missing predict method')
        return False

    # For pipeline models, verify structure
    if hasattr(model, 'steps'):
        logger.debug(f'{model_name} is a Pipeline with {len(model.steps)} steps')
        for step_name, step_obj in model.steps:
            logger.debug(f'  - {step_name}: {type(step_obj).__name__}')

    return True


# ============================================================================
# Lock Ordering Validation (Development Mode)
# ============================================================================
#
# To prevent deadlock, locks must be acquired in a consistent order.
# This system validates lock ordering at runtime in development mode.
#
# Lock Order Hierarchy (must acquire in this order):
#   1. _lexical_model_lock (lowest priority)
#   2. _prosodic_model_lock (medium priority)
#   3. _onnx_session_lock (highest priority)
#
# Valid patterns:
#   - Acquire only one lock (any lock)
#   - Acquire prosodic, then onnx (nested)
#   - Acquire lexical alone, prosodic alone, or onnx alone
#
# Invalid patterns (will raise LockOrderingError in dev mode):
#   - Acquire onnx, then prosodic (reverse order - deadlock risk!)
#   - Acquire onnx, then lexical (reverse order - deadlock risk!)
#   - Acquire prosodic, then lexical (reverse order - deadlock risk!)
#
# Performance: Validation only runs in development mode (FLASK_ENV != 'production')
# In production, validation is disabled for performance.
# ============================================================================

# Enable lock ordering validation in development mode only
_ENABLE_LOCK_ORDERING_VALIDATION = FLASK_ENV != 'production'

# Thread-local storage to track which locks each thread currently holds
# Each thread gets its own set of held locks to avoid interference
_thread_local = threading.local()


class LockOrderingError(RuntimeError):
    """
    Raised when locks are acquired in the wrong order, creating deadlock risk.

    This error indicates a bug in the code that could cause deadlock in production.
    Fix by reordering lock acquisitions to follow the documented hierarchy.
    """

    pass


class OrderedLock:
    """
    A lock wrapper that validates lock ordering to prevent deadlock.

    Tracks lock acquisitions per thread and raises LockOrderingError if locks
    are acquired in the wrong order (only in development mode).

    Usage:
        lock = OrderedLock(threading.Lock(), name="my_lock", order=1)
        with lock:
            # Critical section
            pass
    """

    def __init__(self, lock: threading.Lock, name: str, order: int):
        """
        Initialize an ordered lock.

        Args:
            lock: The underlying threading.Lock to wrap
            name: Human-readable name for error messages
            order: Priority in lock hierarchy (lower numbers acquired first)
        """
        self._lock = lock
        self._name = name
        self._order = order

    @property
    def name(self) -> str:
        """Get the lock name for debugging."""
        return self._name

    @property
    def order(self) -> int:
        """Get the lock's position in the hierarchy."""
        return self._order

    def _get_held_locks(self) -> list['OrderedLock']:
        """Get the list of locks currently held by this thread."""
        if not hasattr(_thread_local, 'held_locks'):
            _thread_local.held_locks = []
        return _thread_local.held_locks

    def _validate_lock_order(self) -> None:
        """
        Validate that acquiring this lock doesn't violate lock ordering.

        Raises:
            LockOrderingError: If acquiring this lock would violate ordering
        """
        if not _ENABLE_LOCK_ORDERING_VALIDATION:
            return  # Skip validation in production

        held_locks = self._get_held_locks()

        # Check if we're acquiring locks in the wrong order
        for held_lock in held_locks:
            if held_lock._order > self._order:
                # We're trying to acquire a lower-order lock while holding a higher-order lock
                # This is a lock ordering violation that can cause deadlock
                error_msg = (
                    f'\n'
                    f'============================================================\n'
                    f'LOCK ORDERING VIOLATION DETECTED\n'
                    f'============================================================\n'
                    f'Attempting to acquire locks in wrong order!\n'
                    f'\n'
                    f'Currently holding: {held_lock.name} (order={held_lock.order})\n'
                    f'Trying to acquire: {self._name} (order={self._order})\n'
                    f'\n'
                    f'This violates the required lock ordering and can cause deadlock.\n'
                    f'\n'
                    f'Required lock order (lowest to highest):\n'
                    f'  1. _lexical_model_lock (order=1)\n'
                    f'  2. _prosodic_model_lock (order=2)\n'
                    f'  3. _onnx_session_lock (order=3)\n'
                    f'\n'
                    f'Fix: Reorder your lock acquisitions to follow this hierarchy.\n'
                    f'============================================================\n'
                )
                logger.error(error_msg)
                raise LockOrderingError(error_msg)

    def acquire(self, blocking: bool = True, timeout: float = -1) -> bool:
        """
        Acquire the lock with ordering validation.

        Args:
            blocking: Whether to block waiting for the lock
            timeout: Maximum time to wait for lock (-1 = infinite)

        Returns:
            True if lock acquired, False otherwise

        Raises:
            LockOrderingError: If lock ordering is violated
        """
        self._validate_lock_order()

        # Acquire the underlying lock
        acquired = self._lock.acquire(blocking=blocking, timeout=timeout)

        # Track that we're holding this lock
        if acquired and _ENABLE_LOCK_ORDERING_VALIDATION:
            held_locks = self._get_held_locks()
            held_locks.append(self)

        return acquired

    def release(self) -> None:
        """Release the lock and remove from held locks."""
        self._lock.release()

        # Remove from held locks
        if _ENABLE_LOCK_ORDERING_VALIDATION:
            held_locks = self._get_held_locks()
            if self in held_locks:
                held_locks.remove(self)

    def __enter__(self):
        """Context manager entry - acquire lock."""
        self.acquire()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - release lock."""
        self.release()
        return False


# ============================================================================
# Model State (module-level singletons)
# ============================================================================

# Thread locks to prevent race conditions during model loading
# CRITICAL: Flask apps run in multi-threaded environments (gunicorn workers)
# Multiple requests could trigger concurrent model loading without locks
#
# Lock Ordering (to prevent deadlock):
#   1. _lexical_model_lock (order=1, lowest priority)
#   2. _prosodic_model_lock (order=2, medium priority)
#   3. _onnx_session_lock (order=3, highest priority)
#
# Valid: prosodic -> onnx (used by load_prosodic_models)
# Invalid: onnx -> prosodic (would cause deadlock!)
_lexical_model_lock = OrderedLock(threading.Lock(), '_lexical_model_lock', order=1)
_prosodic_model_lock = OrderedLock(threading.Lock(), '_prosodic_model_lock', order=2)
_onnx_session_lock = OrderedLock(threading.Lock(), '_onnx_session_lock', order=3)

_lexical_model = None
_prosodic_model = None
_onnx_session = None
_onnx_available = False

# Try to import ONNX Runtime for prosodic (audio-based) detection.
# ONNX Runtime provides lightweight inference (~150MB vs ~700MB for PyTorch).
try:
    import onnxruntime as ort  # noqa: F401

    _onnx_available = True
    logger.info('ONNX Runtime loaded successfully')
except ImportError as e:
    logger.warning(f'Could not import ONNX Runtime: {e}')
    logger.warning('Prosodic endpoint will return mock data')


# ============================================================================
# Lock Ordering Utilities (for testing and debugging)
# ============================================================================


def get_held_locks() -> list[tuple[str, int]]:
    """
    Get the list of locks currently held by this thread.

    Returns:
        List of (lock_name, lock_order) tuples for all held locks.
        Empty list if validation is disabled or no locks held.
    """
    if not _ENABLE_LOCK_ORDERING_VALIDATION:
        return []

    if not hasattr(_thread_local, 'held_locks'):
        return []

    return [(lock.name, lock.order) for lock in _thread_local.held_locks]


@contextmanager
def enable_lock_ordering_validation(enabled: bool = True):
    """
    Temporarily enable or disable lock ordering validation.

    This is useful for testing lock ordering violations without changing
    the global FLASK_ENV setting.

    Args:
        enabled: Whether to enable validation

    Example:
        with enable_lock_ordering_validation(True):
            # Lock ordering will be validated here
            with _prosodic_model_lock:
                pass
    """
    global _ENABLE_LOCK_ORDERING_VALIDATION

    old_value = _ENABLE_LOCK_ORDERING_VALIDATION
    _ENABLE_LOCK_ORDERING_VALIDATION = enabled

    try:
        yield
    finally:
        _ENABLE_LOCK_ORDERING_VALIDATION = old_value


# ============================================================================
# Public API
# ============================================================================


def is_onnx_available() -> bool:
    """Check if ONNX Runtime is available."""
    return _onnx_available


def get_lexical_model():
    """Get the loaded lexical model (may be None if not loaded)."""
    return _lexical_model


def get_prosodic_model():
    """Get the loaded prosodic classifier (may be None if not loaded)."""
    return _prosodic_model


def get_onnx_session():
    """Get the ONNX Runtime session for Wav2Vec2 (may be None if not loaded)."""
    return _onnx_session


def load_lexical_model() -> bool:
    """
    Load the lexical sarcasm detection model securely.

    Uses RestrictedUnpickler to prevent arbitrary code execution from
    malicious pickle files. Only trusted scikit-learn classes are allowed.

    Thread-safe: Uses locks to prevent race conditions in multi-threaded environments.

    Returns:
        bool: True if model loaded and validated successfully, False otherwise.
    """
    global _lexical_model

    # Fast path: check without lock (common case - model already loaded)
    if _lexical_model is not None:
        return True

    # Acquire lock for model loading (prevents concurrent loads)
    with _lexical_model_lock:
        # Double-check pattern: another thread may have loaded it while we waited
        if _lexical_model is not None:
            return True

        if not os.path.exists(LEXICAL_MODEL_PATH):
            logger.warning(f'Could not find lexical model at {LEXICAL_MODEL_PATH}')
            return False

        try:
            logger.info(f'Loading lexical model from: {LEXICAL_MODEL_PATH}')

            # Use secure restricted unpickler instead of pickle.load()
            model = secure_load_pickle(LEXICAL_MODEL_PATH)

            # Validate the loaded model has expected interface
            if not validate_sklearn_model(model, 'Lexical model'):
                logger.error('Lexical model validation failed')
                return False

            _lexical_model = model
            logger.info('Lexical model loaded and validated successfully')
            return True

        except pickle.UnpicklingError as e:
            logger.error(f'[SECURITY] Lexical model loading blocked: {e}')
            return False
        except Exception as e:
            logger.error(f'Failed to load lexical model: {e}')
            return False


def load_onnx_model() -> bool:
    """
    Load the ONNX Wav2Vec2 model for audio embedding extraction.

    Thread-safe: Uses locks to prevent race conditions in multi-threaded environments.
    Lock ordering: When called from load_prosodic_models(), this function acquires
    _onnx_session_lock while the caller holds _prosodic_model_lock. This establishes
    consistent lock ordering (prosodic -> onnx) to prevent deadlock.

    Returns:
        bool: True if model loaded successfully, False otherwise.
    """
    global _onnx_session

    # Fast path: check without lock (common case - model already loaded)
    if _onnx_session is not None:
        return True

    # CRITICAL: Always acquire lock to prevent concurrent model loading
    # Lock ordering: When called from load_prosodic_models(), we already hold
    # _prosodic_model_lock, so we acquire _onnx_session_lock second.
    # This establishes consistent ordering: prosodic -> onnx, preventing deadlock.
    # Threads calling load_onnx_model() directly only acquire onnx lock (no deadlock).
    # Threads calling load_prosodic_models() acquire prosodic then onnx (consistent order).
    # Use context manager to ensure lock is always released, even on exceptions
    with _onnx_session_lock:
        # Double-check pattern: another thread may have loaded it while we waited for lock
        if _onnx_session is not None:
            return True

        if not _onnx_available:
            logger.warning('ONNX Runtime not available')
            return False

        if not os.path.exists(ONNX_MODEL_PATH):
            logger.warning(f'Could not find ONNX model at {ONNX_MODEL_PATH}')
            return False

        try:
            logger.info(f'Loading ONNX model from: {ONNX_MODEL_PATH}')

            import onnxruntime as ort

            session = ort.InferenceSession(ONNX_MODEL_PATH, providers=['CPUExecutionProvider'])

            # SECURITY: Validate session was created successfully before assigning
            if session is None:
                logger.error('[SECURITY] ONNX InferenceSession creation returned None')
                return False

            # Only assign after successful creation to prevent partial state
            _onnx_session = session
            logger.info('ONNX Wav2Vec2 model loaded successfully')
            return True

        except Exception as e:
            logger.error(f'Failed to load ONNX model: {e}')
            # Ensure session is None on failure to prevent inconsistent state
            _onnx_session = None
            return False


def load_prosodic_models() -> bool:
    """
    Load prosodic model components.
    Loads both ONNX encoder and the prosodic classifier.

    Thread-safe: Uses locks to prevent race conditions in multi-threaded environments.

    Returns:
        bool: True if all models loaded successfully, False otherwise.
    """
    global _prosodic_model, _onnx_session

    # Fast path: check without lock (common case - model already loaded)
    # CRITICAL: Only read operations outside lock - never modify shared state
    # SECURITY: Read both variables atomically to avoid race condition where
    # one is set but the other is not, leading to inconsistent state
    prosodic_model_check = _prosodic_model is not None
    onnx_session_check = _onnx_session is not None

    if prosodic_model_check and onnx_session_check:
        return True
    # If either is None, we need to reload, but must do it inside lock
    # Don't modify shared state here - let the lock-protected section handle it

    # Acquire lock for model loading (prevents concurrent loads)
    with _prosodic_model_lock:
        # Double-check pattern: another thread may have loaded it while we waited
        # CRITICAL: Re-check both variables inside lock to ensure consistency
        if _prosodic_model is not None and _onnx_session is not None:
            return True
        elif _prosodic_model is not None and _onnx_session is None:
            logger.warning('[PROSODIC] Prosodic model loaded but ONNX session missing - reloading')
            # CRITICAL: Only modify shared state inside lock
            _prosodic_model = None  # Force reload

        # Load ONNX encoder first (this function is already thread-safe)
        # CRITICAL: Load ONNX inside the prosodic lock to ensure consistency
        # Lock ordering: We hold _prosodic_model_lock, then load_onnx_model() acquires
        # _onnx_session_lock. This establishes consistent ordering (prosodic -> onnx)
        # to prevent deadlock. Other threads calling load_onnx_model() directly only
        # acquire onnx lock, so no deadlock is possible.
        if not load_onnx_model():
            logger.error('[PROSODIC] Failed to load ONNX model - cannot load prosodic classifier')
            return False

        # Verify ONNX session is actually available after loading
        # CRITICAL: Read _onnx_session directly inside lock to ensure consistency
        # Using get_onnx_session() would read outside the lock, creating a race condition
        if _onnx_session is None:
            logger.error('[PROSODIC] ONNX model reported loaded but session is None')
            return False

        if not os.path.exists(PROSODIC_MODEL_PATH):
            logger.warning(f'Could not find prosodic model at {PROSODIC_MODEL_PATH}')
            return False

        try:
            logger.info(f'Loading prosodic classifier from: {PROSODIC_MODEL_PATH}')

            # Use secure restricted unpickler instead of pickle.load()
            model = secure_load_pickle(PROSODIC_MODEL_PATH)

            # Validate the loaded model has expected interface
            if not validate_sklearn_model(model, 'Prosodic model'):
                logger.error('Prosodic model validation failed')
                return False

            _prosodic_model = model
            logger.info('Prosodic classifier loaded and validated successfully')

        except pickle.UnpicklingError as e:
            logger.error(f'[SECURITY] Prosodic model loading blocked: {e}')
            return False
        except Exception as e:
            logger.error(f'Failed to load prosodic classifier: {e}')
            return False

    return True


# ============================================================================
# Startup Loading
# ============================================================================

# Note: Model loading is handled by preload_models() in app.py, which respects
# the PRELOAD_MODELS configuration. We don't load at import time to avoid
# preventing app startup if model loading fails and to respect user preferences.
#
# Models will be loaded on first request if not preloaded, ensuring graceful
# degradation rather than startup failure.
