"""
Model loading and management for sarcasm detection models.
Handles both lexical (text-based) and prosodic (audio-based) models.

Security: Uses RestrictedUnpickler to only allow trusted scikit-learn and numpy
classes during deserialization, preventing arbitrary code execution from malicious
pickle files.
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
TRUSTED_MODULES = frozenset(
    [
        # -------------------------------------------------------------------------
        # scikit-learn modules (explicitly enumerated for security)
        # -------------------------------------------------------------------------
        # Core pipeline
        'sklearn.pipeline',
        'sklearn._config',
        'sklearn.base',
        # Feature extraction (TF-IDF)
        'sklearn.feature_extraction.text',
        'sklearn.feature_extraction._hash',
        'sklearn.feature_extraction._stop_words',
        # Linear models (LogisticRegression)
        'sklearn.linear_model',
        'sklearn.linear_model._logistic',
        'sklearn.linear_model._base',
        # SVM (LinearSVC, used in ensemble)
        'sklearn.svm',
        'sklearn.svm._base',
        'sklearn.svm._classes',
        # Ensemble models (VotingClassifier, etc.)
        'sklearn.ensemble',
        'sklearn.ensemble._voting',
        'sklearn.ensemble._base',
        'sklearn.ensemble._forest',
        'sklearn.ensemble._gb',
        # Calibration (CalibratedClassifierCV wraps SVC)
        'sklearn.calibration',
        # Naive Bayes
        'sklearn.naive_bayes',
        # Preprocessing (StandardScaler for prosodic model)
        'sklearn.preprocessing',
        'sklearn.preprocessing._data',
        'sklearn.preprocessing._label',
        # Utils (internal helpers)
        'sklearn.utils',
        'sklearn.utils._bunch',
        'sklearn.utils._tags',
        'sklearn.utils._param_validation',
        'sklearn.utils.metadata_routing',
        # -------------------------------------------------------------------------
        # numpy (required by sklearn for arrays)
        # -------------------------------------------------------------------------
        'numpy',
        'numpy.core',
        'numpy.core.multiarray',
        'numpy.core.numeric',
        'numpy._core',
        'numpy._core.multiarray',
        'numpy.dtypes',
        'numpy.random',
        'numpy.random._pickle',
        # -------------------------------------------------------------------------
        # scipy sparse matrices (used by TF-IDF vectorizer)
        # -------------------------------------------------------------------------
        'scipy.sparse',
        'scipy.sparse._csr',
        'scipy.sparse._csc',
        'scipy.sparse._arrays',
        'scipy.sparse._matrix',
        # -------------------------------------------------------------------------
        # Python builtins (safe types: dict, list, tuple, set, etc.)
        # -------------------------------------------------------------------------
        'builtins',
        'collections',
        # copy_reg for reconstructors
        'copy_reg',
        '_codecs',
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
