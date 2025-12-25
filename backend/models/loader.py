"""
Model loading and management for sarcasm detection models.
Handles both lexical (text-based) and prosodic (audio-based) models.

Security: Uses RestrictedUnpickler to only allow trusted scikit-learn and numpy
classes during deserialization, preventing arbitrary code execution from malicious
pickle files.

Future Considerations:
    - Consider using joblib for model serialization (safer than pickle, designed for sklearn)
    - Consider ONNX format for cross-platform model deployment (already used for Wav2Vec2)
    - When retraining models, prefer joblib.dump() over pickle.dump() for better security
    - See: https://scikit-learn.org/stable/modules/model_persistence.html#security-maintainability-limitations
"""

import logging
import os
import pickle

from config import LEXICAL_MODEL_PATH, PROSODIC_MODEL_PATH

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
            pickle.UnpicklingError: If module is not in the allowlist
        """
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


def secure_load_pickle(filepath: str):
    """
    Securely load a pickle file using RestrictedUnpickler.

    Args:
        filepath: Path to the pickle file

    Returns:
        The unpickled object

    Raises:
        pickle.UnpicklingError: If untrusted classes are found
        FileNotFoundError: If file doesn't exist
    """
    with open(filepath, 'rb') as f:
        return RestrictedUnpickler(f).load()


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
# Model State (module-level singletons)
# ============================================================================

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

    Returns:
        bool: True if model loaded and validated successfully, False otherwise.
    """
    global _lexical_model

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

    Returns:
        bool: True if model loaded successfully, False otherwise.
    """
    global _onnx_session

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

        _onnx_session = ort.InferenceSession(ONNX_MODEL_PATH, providers=['CPUExecutionProvider'])

        logger.info('ONNX Wav2Vec2 model loaded successfully')
        return True

    except Exception as e:
        logger.error(f'Failed to load ONNX model: {e}')
        return False


def load_prosodic_models() -> bool:
    """
    Load prosodic model components.
    Loads both ONNX encoder and the prosodic classifier.

    Returns:
        bool: True if all models loaded successfully, False otherwise.
    """
    global _prosodic_model

    # Load ONNX encoder
    if not load_onnx_model():
        return False

    # Load classifier securely
    if _prosodic_model is None:
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

# Load lexical model at import time (it's small and fast)
load_lexical_model()
