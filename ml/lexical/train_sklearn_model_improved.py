"""
Improved scikit-learn text classification model for sarcasm detection.
Uses hyperparameter tuning and compares multiple classifiers to maximize accuracy.

Run: python train_sklearn_model_improved.py

Data: Uses the News Headlines Sarcasm dataset. The script will:
  1. First check for local data in ./data/sarcasm.json
  2. If not found, download from Google Cloud Storage
  3. Cache the downloaded data locally for future runs
"""

import urllib.request
import json
import pickle
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.ensemble import GradientBoostingClassifier, VotingClassifier
from sklearn.naive_bayes import ComplementNB
from sklearn.pipeline import Pipeline
from sklearn.model_selection import (
    train_test_split,
    GridSearchCV,
    StratifiedKFold,
    cross_val_score,
)
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.calibration import CalibratedClassifierCV
import warnings

warnings.filterwarnings("ignore")

# =============================================================================
# Configuration
# =============================================================================

RANDOM_STATE = 42
TEST_SIZE = 0.2
CV_FOLDS = 5

# Paths
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / "data"
LOCAL_DATA_PATH = DATA_DIR / "sarcasm.json"
REMOTE_DATA_URL = "https://storage.googleapis.com/learning-datasets/sarcasm.json"

# =============================================================================
# Data Loading & Preprocessing
# =============================================================================


def load_dataset():
    """
    Load the sarcasm dataset, preferring local cache over remote download.

    Priority:
      1. Local file at ./data/sarcasm.json (fastest, works offline)
      2. Download from Google Cloud Storage (fallback, caches locally)

    Returns:
        List of dictionaries with 'headline' and 'is_sarcastic' keys
    """
    # Check for local data first
    if LOCAL_DATA_PATH.exists():
        print(f"📁 Loading local dataset from {LOCAL_DATA_PATH}")
        with open(LOCAL_DATA_PATH, "r") as f:
            datastore = json.load(f)
        print(f"   ✓ Loaded {len(datastore):,} samples from local cache")
        return datastore

    # Download from remote URL
    print(f"📥 Local data not found at {LOCAL_DATA_PATH}")
    print(f"   Downloading from {REMOTE_DATA_URL}...")

    try:
        # Ensure data directory exists
        DATA_DIR.mkdir(parents=True, exist_ok=True)

        # Download to local cache
        urllib.request.urlretrieve(REMOTE_DATA_URL, LOCAL_DATA_PATH)
        print(f"   ✓ Downloaded and cached to {LOCAL_DATA_PATH}")

        with open(LOCAL_DATA_PATH, "r") as f:
            datastore = json.load(f)

        return datastore

    except Exception as e:
        print(f"   ✗ Download failed: {e}")
        print("\n   To fix this, manually download the dataset:")
        print(f"   curl -o {LOCAL_DATA_PATH} {REMOTE_DATA_URL}")
        raise RuntimeError(f"Failed to load sarcasm dataset: {e}")


def preprocess_text(text):
    """
    Preprocess text for better feature extraction.
    - Normalize whitespace
    - Handle punctuation patterns that indicate sarcasm
    """
    # Normalize whitespace
    text = " ".join(text.split())
    # Keep punctuation as it can be a sarcasm indicator
    return text.lower()


def extract_meta_features(text):
    """
    Extract meta-features that may indicate sarcasm:
    - Punctuation patterns (!!!, ???, ...)
    - All caps words
    - Quote usage
    """
    features = {}
    features["has_ellipsis"] = int("..." in text)
    features["exclamation_count"] = text.count("!")
    features["question_count"] = text.count("?")
    features["caps_ratio"] = sum(1 for c in text if c.isupper()) / max(len(text), 1)
    features["has_quotes"] = int('"' in text or "'" in text)
    return features


# =============================================================================
# Model Definitions
# =============================================================================


def get_tfidf_configs():
    """Different TF-IDF configurations to try."""
    return {
        "standard": TfidfVectorizer(
            max_features=15000,
            ngram_range=(1, 2),
            stop_words="english",
            min_df=2,
            max_df=0.95,
            sublinear_tf=True,  # Use log(1 + tf) instead of tf
        ),
        "with_char_ngrams": TfidfVectorizer(
            max_features=20000,
            analyzer="char_wb",  # Character n-grams within word boundaries
            ngram_range=(3, 5),
            min_df=2,
        ),
        "combined": TfidfVectorizer(
            max_features=20000,
            ngram_range=(1, 3),  # Up to trigrams
            stop_words="english",
            min_df=2,
            max_df=0.9,
            sublinear_tf=True,
        ),
    }


def get_classifiers():
    """Dictionary of classifiers to compare."""
    return {
        "LogisticRegression": LogisticRegression(
            max_iter=2000,
            C=1.0,
            class_weight="balanced",
            random_state=RANDOM_STATE,
            solver="lbfgs",
        ),
        "LogisticRegression_L1": LogisticRegression(
            max_iter=2000,
            C=0.5,
            penalty="l1",
            solver="saga",
            class_weight="balanced",
            random_state=RANDOM_STATE,
        ),
        "LinearSVC": CalibratedClassifierCV(
            LinearSVC(
                C=1.0, class_weight="balanced", random_state=RANDOM_STATE, max_iter=2000
            ),
            cv=3,
        ),
        "ComplementNB": ComplementNB(alpha=0.5),
        "GradientBoosting": GradientBoostingClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.1,
            random_state=RANDOM_STATE,
        ),
    }


# =============================================================================
# Hyperparameter Tuning
# =============================================================================


def tune_logistic_regression(X_train, y_train):
    """Tune Logistic Regression with GridSearchCV."""
    print("\n🔧 Tuning Logistic Regression hyperparameters...")

    pipeline = Pipeline(
        [
            ("tfidf", TfidfVectorizer()),
            ("clf", LogisticRegression(max_iter=2000, random_state=RANDOM_STATE)),
        ]
    )

    param_grid = {
        "tfidf__max_features": [10000, 15000, 20000],
        "tfidf__ngram_range": [(1, 2), (1, 3)],
        "tfidf__sublinear_tf": [True, False],
        "tfidf__min_df": [1, 2, 3],
        "clf__C": [0.1, 0.5, 1.0, 2.0],
        "clf__class_weight": [None, "balanced"],
    }

    # Use RandomizedSearchCV for faster search
    from sklearn.model_selection import RandomizedSearchCV

    grid_search = RandomizedSearchCV(
        pipeline,
        param_distributions=param_grid,
        n_iter=30,  # Number of parameter settings sampled
        cv=StratifiedKFold(n_splits=3, shuffle=True, random_state=RANDOM_STATE),
        scoring="accuracy",
        n_jobs=-1,
        verbose=1,
        random_state=RANDOM_STATE,
    )

    grid_search.fit(X_train, y_train)

    print(f"   Best CV Accuracy: {grid_search.best_score_:.4f}")
    print(f"   Best Parameters: {grid_search.best_params_}")

    return grid_search.best_estimator_, grid_search.best_params_


def tune_svm(X_train, y_train):
    """Tune Linear SVM with GridSearchCV."""
    print("\n🔧 Tuning Linear SVM hyperparameters...")

    pipeline = Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    max_features=15000, ngram_range=(1, 2), sublinear_tf=True, min_df=2
                ),
            ),
            ("clf", LinearSVC(max_iter=2000, random_state=RANDOM_STATE)),
        ]
    )

    param_grid = {
        "clf__C": [0.1, 0.5, 1.0, 2.0, 5.0],
        "clf__class_weight": [None, "balanced"],
    }

    grid_search = GridSearchCV(
        pipeline,
        param_grid,
        cv=StratifiedKFold(n_splits=3, shuffle=True, random_state=RANDOM_STATE),
        scoring="accuracy",
        n_jobs=-1,
        verbose=1,
    )

    grid_search.fit(X_train, y_train)

    print(f"   Best CV Accuracy: {grid_search.best_score_:.4f}")
    print(f"   Best Parameters: {grid_search.best_params_}")

    # Wrap in CalibratedClassifierCV for probability estimates
    best_pipeline = grid_search.best_estimator_

    return best_pipeline, grid_search.best_params_


# =============================================================================
# Evaluation
# =============================================================================


def evaluate_model(model, X_test, y_test, model_name="Model"):
    """Evaluate a model and print metrics."""
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)

    print(f"\n📊 {model_name} Results:")
    print(f"   Test Accuracy: {accuracy:.4f} ({accuracy * 100:.2f}%)")
    print("\n   Classification Report:")
    print(
        classification_report(
            y_test, y_pred, target_names=["Not Sarcastic", "Sarcastic"]
        )
    )

    # Confusion Matrix
    cm = confusion_matrix(y_test, y_pred)
    print("   Confusion Matrix:")
    print(f"   TN={cm[0][0]:4d}  FP={cm[0][1]:4d}")
    print(f"   FN={cm[1][0]:4d}  TP={cm[1][1]:4d}")

    return accuracy


def cross_validate_model(pipeline, X, y, model_name="Model"):
    """Perform stratified k-fold cross-validation."""
    cv = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    scores = cross_val_score(pipeline, X, y, cv=cv, scoring="accuracy", n_jobs=-1)

    print(
        f"   {model_name}: CV Accuracy = {scores.mean():.4f} (±{scores.std() * 2:.4f})"
    )
    return scores.mean()


# =============================================================================
# Main Training Pipeline
# =============================================================================


def main():
    print("=" * 60)
    print("🎯 SARCASM DETECTION MODEL - IMPROVED TRAINING")
    print("=" * 60)

    # Load data
    datastore = load_dataset()
    sentences = [item["headline"] for item in datastore]
    labels = [item["is_sarcastic"] for item in datastore]

    print("\n📊 Dataset Statistics:")
    print(f"   Total samples: {len(sentences):,}")
    print(f"   Sarcastic: {sum(labels):,} ({sum(labels) / len(labels) * 100:.1f}%)")
    print(
        f"   Not Sarcastic: {len(labels) - sum(labels):,} ({(1 - sum(labels) / len(labels)) * 100:.1f}%)"
    )

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        sentences,
        labels,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=labels,
    )

    print(f"\n   Training samples: {len(X_train):,}")
    print(f"   Test samples: {len(X_test):,}")

    # ==========================================================================
    # PHASE 1: Compare different classifier/vectorizer combinations
    # ==========================================================================
    print("\n" + "=" * 60)
    print("📈 PHASE 1: Comparing Classifiers (Quick Evaluation)")
    print("=" * 60)

    results = {}
    tfidf_configs = get_tfidf_configs()
    classifiers = get_classifiers()

    # Test key combinations
    test_combinations = [
        ("standard", "LogisticRegression"),
        ("standard", "LogisticRegression_L1"),
        ("standard", "LinearSVC"),
        ("combined", "LogisticRegression"),
        ("combined", "ComplementNB"),
    ]

    for tfidf_name, clf_name in test_combinations:
        pipeline = Pipeline(
            [("tfidf", tfidf_configs[tfidf_name]), ("clf", classifiers[clf_name])]
        )

        # Quick train/test evaluation
        pipeline.fit(X_train, y_train)
        y_pred = pipeline.predict(X_test)
        acc = accuracy_score(y_test, y_pred)

        combo_name = f"{tfidf_name} + {clf_name}"
        results[combo_name] = acc
        print(f"   {combo_name}: {acc:.4f}")

    # ==========================================================================
    # PHASE 2: Hyperparameter Tuning for Best Candidates
    # ==========================================================================
    print("\n" + "=" * 60)
    print("🔍 PHASE 2: Hyperparameter Tuning")
    print("=" * 60)

    # Tune Logistic Regression
    best_lr_model, best_lr_params = tune_logistic_regression(X_train, y_train)
    lr_accuracy = evaluate_model(
        best_lr_model, X_test, y_test, "Tuned Logistic Regression"
    )
    results["Tuned LogisticRegression"] = lr_accuracy

    # Tune SVM
    best_svm_model, best_svm_params = tune_svm(X_train, y_train)

    # Need to wrap SVM for probability estimates
    # Calibrate the SVM pipeline for probability outputs
    print("\n🔧 Calibrating SVM for probability estimates...")
    calibrated_svm = CalibratedClassifierCV(best_svm_model, cv=3, method="sigmoid")
    calibrated_svm.fit(X_train, y_train)
    svm_accuracy = evaluate_model(
        calibrated_svm, X_test, y_test, "Tuned & Calibrated LinearSVC"
    )
    results["Tuned LinearSVC"] = svm_accuracy

    # ==========================================================================
    # PHASE 3: Create Ensemble Model
    # ==========================================================================
    print("\n" + "=" * 60)
    print("🤝 PHASE 3: Ensemble Model")
    print("=" * 60)

    # Create an ensemble of the best performing models
    print("\n🔧 Building Voting Ensemble...")

    # Define base models for ensemble
    model1 = Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    max_features=15000,
                    ngram_range=(1, 2),
                    sublinear_tf=True,
                    min_df=2,
                    stop_words="english",
                ),
            ),
            (
                "clf",
                LogisticRegression(
                    max_iter=2000,
                    C=1.0,
                    class_weight="balanced",
                    random_state=RANDOM_STATE,
                ),
            ),
        ]
    )

    model2 = Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    max_features=20000,
                    ngram_range=(1, 3),
                    sublinear_tf=True,
                    min_df=2,
                ),
            ),
            (
                "clf",
                LogisticRegression(
                    max_iter=2000,
                    C=0.5,
                    penalty="l1",
                    solver="saga",
                    random_state=RANDOM_STATE,
                ),
            ),
        ]
    )

    model3 = Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    max_features=15000,
                    ngram_range=(1, 2),
                    sublinear_tf=True,
                    min_df=2,
                ),
            ),
            (
                "clf",
                CalibratedClassifierCV(
                    LinearSVC(
                        C=1.0,
                        class_weight="balanced",
                        max_iter=2000,
                        random_state=RANDOM_STATE,
                    ),
                    cv=3,
                ),
            ),
        ]
    )

    # Soft voting uses predicted probabilities
    ensemble = VotingClassifier(
        estimators=[
            ("lr1", model1),
            ("lr2", model2),
            ("svc", model3),
        ],
        voting="soft",
        n_jobs=-1,
    )

    print("   Training ensemble model...")
    ensemble.fit(X_train, y_train)
    ensemble_accuracy = evaluate_model(ensemble, X_test, y_test, "Voting Ensemble")
    results["Voting Ensemble"] = ensemble_accuracy

    # ==========================================================================
    # PHASE 4: Final Model Selection & Saving
    # ==========================================================================
    print("\n" + "=" * 60)
    print("🏆 PHASE 4: Final Results & Model Selection")
    print("=" * 60)

    # Sort results
    sorted_results = sorted(results.items(), key=lambda x: x[1], reverse=True)

    print("\n📊 All Results (sorted by accuracy):")
    for name, acc in sorted_results:
        marker = "👑" if name == sorted_results[0][0] else "  "
        print(f"   {marker} {name}: {acc:.4f} ({acc * 100:.2f}%)")

    # Determine best model
    best_name, best_acc = sorted_results[0]
    print(f"\n✨ Best Model: {best_name} with {best_acc:.4f} accuracy")

    # Select the actual model object based on best performance
    if "Ensemble" in best_name:
        final_model = ensemble
    elif "LinearSVC" in best_name:
        final_model = calibrated_svm
    else:
        final_model = best_lr_model

    # If ensemble isn't the best but is close, prefer it for robustness
    if "Ensemble" not in best_name and ensemble_accuracy >= best_acc - 0.005:
        print("   📌 Using Ensemble instead (within 0.5% of best, more robust)")
        final_model = ensemble
        best_name = "Voting Ensemble"
        best_acc = ensemble_accuracy

    # Save the best model
    from pathlib import Path

    SCRIPT_DIR = Path(__file__).parent
    BACKEND_DIR = SCRIPT_DIR.parent.parent / "backend"
    output_path = BACKEND_DIR / "sarcasm_model.pkl"
    with open(output_path, "wb") as f:
        pickle.dump(final_model, f)
    print(f"\n💾 Model saved to: {output_path}")

    # Also save a local copy
    local_path = SCRIPT_DIR / "sarcasm_model_improved.pkl"
    with open(local_path, "wb") as f:
        pickle.dump(final_model, f)
    print(f"💾 Backup saved to: {local_path}")

    # ==========================================================================
    # Test Predictions
    # ==========================================================================
    print("\n" + "=" * 60)
    print("🧪 Test Predictions")
    print("=" * 60)

    test_sentences = [
        "Oh great, another meeting that could have been an email",
        "Wow, you are SO smart, I cannot believe how intelligent you are",
        "Thank you for helping me with my homework, I really appreciate it",
        "The weather is nice today",
        "Yeah right, like that's ever going to happen",
        "Scientists discover water is wet",
        "Local man shocked his lottery numbers didn't win",
        "I love waiting in traffic, it's my favorite thing",
        "The new policy has been well received by employees",
        "Area man confident he'll start exercising tomorrow",
    ]

    print("\n📝 Sample Predictions:")
    for sentence in test_sentences:
        if hasattr(final_model, "predict_proba"):
            prob = final_model.predict_proba([sentence])[0][1]
        else:
            # For models without predict_proba
            prob = final_model.predict([sentence])[0]

        label = "Sarcastic" if prob > 0.5 else "Not Sarcastic"
        emoji = "😏" if prob > 0.5 else "😐"
        print(f"   {emoji} [{prob:.3f}] '{sentence[:55]}...'")

    print("\n" + "=" * 60)
    print("✅ Training Complete!")
    print("=" * 60)

    return final_model, best_acc


if __name__ == "__main__":
    model, accuracy = main()
