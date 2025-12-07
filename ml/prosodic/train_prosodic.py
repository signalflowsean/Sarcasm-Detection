"""
Train Prosodic Sarcasm Detection Model

Trains a Logistic Regression classifier on Wav2Vec2 embeddings.
Follows the same pattern as the lexical model (train_sklearn_model.py).

Usage:
    python train_prosodic.py

Prerequisites:
    - mustard_embeddings.py must be run first to extract embeddings
"""

import pickle
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import cross_val_score, StratifiedKFold, train_test_split
from sklearn.metrics import (
    accuracy_score, 
    f1_score, 
    classification_report,
    roc_auc_score,
    confusion_matrix
)
from sklearn.model_selection import GridSearchCV

# Paths
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / "data"
PROCESSED_DIR = DATA_DIR / "processed"
INDEX_PATH = PROCESSED_DIR / "mustard_index_with_embeddings.csv"
BACKEND_DIR = SCRIPT_DIR.parent.parent / "backend"
OUTPUT_MODEL_PATH = BACKEND_DIR / "prosodic_model.pkl"


def resolve_path(path_str: str) -> Path:
    """
    Resolve a path that may be relative or absolute.
    
    Relative paths are resolved relative to PROCESSED_DIR.
    Absolute paths (for backward compatibility) are used as-is.
    
    Args:
        path_str: Path string (relative or absolute)
    
    Returns:
        Resolved absolute Path
    """
    path = Path(path_str)
    if path.is_absolute():
        return path
    return PROCESSED_DIR / path


def load_embeddings(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """
    Load all embeddings and labels from the index.
    
    Args:
        df: DataFrame with 'embedding_path' and 'label' columns
    
    Returns:
        X: Embeddings array of shape (n_samples, 768)
        y: Labels array of shape (n_samples,)
    """
    X = np.array([np.load(resolve_path(path)) for path in df['embedding_path']])
    y = np.array(df['label'])
    return X, y


def tune_hyperparameters(X: np.ndarray, y: np.ndarray, n_folds: int = 5):
    """
    Tune LogisticRegression hyperparameters using GridSearchCV.
    
    Args:
        X: Feature matrix
        y: Labels
        n_folds: Number of cross-validation folds
    
    Returns:
        best_params: Dictionary of best hyperparameters
        best_score: Best cross-validation score
    """
    print(f"\n{'='*60}")
    print(f"Hyperparameter Tuning ({n_folds}-fold GridSearchCV)")
    print('='*60)
    
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('classifier', LogisticRegression(max_iter=1000, random_state=42, solver='lbfgs'))
    ])
    
    # Parameter grid to search
    param_grid = {
        'classifier__C': [0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
        'classifier__class_weight': [None, 'balanced'],
    }
    
    cv = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=42)
    
    grid_search = GridSearchCV(
        pipeline,
        param_grid,
        cv=cv,
        scoring='f1_weighted',
        n_jobs=-1,
        verbose=1,
        return_train_score=True
    )
    
    print("\nSearching parameter grid...")
    grid_search.fit(X, y)
    
    print(f"\n✓ Best Parameters: {grid_search.best_params_}")
    print(f"✓ Best CV F1 Score: {grid_search.best_score_:.4f}")
    
    # Show top 5 results
    results_df = pd.DataFrame(grid_search.cv_results_)
    results_df = results_df.sort_values('rank_test_score')
    
    print("\nTop 5 Configurations:")
    for i, row in results_df.head(5).iterrows():
        C = row['param_classifier__C']
        cw = row['param_classifier__class_weight']
        score = row['mean_test_score']
        std = row['std_test_score']
        print(f"  C={C:<5} class_weight={str(cw):<10} → F1={score:.4f} (+/- {std*2:.4f})")
    
    return grid_search.best_params_, grid_search.best_score_


def evaluate_with_cross_validation(X: np.ndarray, y: np.ndarray, n_folds: int = 5, C: float = 1.0, class_weight=None):
    """
    Evaluate the model using stratified k-fold cross-validation.
    Uses the same 5-fold approach as the original MUStARD paper.
    
    Args:
        X: Feature matrix
        y: Labels
        n_folds: Number of folds (default 5, same as MUStARD)
        C: Regularization parameter (from hyperparameter tuning)
        class_weight: Class weight parameter (from hyperparameter tuning)
    
    Returns:
        Dictionary of mean scores
    """
    print(f"\n{'='*60}")
    print(f"Cross-Validation Evaluation ({n_folds}-fold)")
    print('='*60)
    
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('classifier', LogisticRegression(
            max_iter=1000,
            C=C,
            class_weight=class_weight,
            random_state=42,
            solver='lbfgs'
        ))
    ])
    
    cv = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=42)
    
    # Compute various metrics
    accuracy_scores = cross_val_score(pipeline, X, y, cv=cv, scoring='accuracy')
    f1_weighted_scores = cross_val_score(pipeline, X, y, cv=cv, scoring='f1_weighted')
    f1_macro_scores = cross_val_score(pipeline, X, y, cv=cv, scoring='f1_macro')
    roc_auc_scores = cross_val_score(pipeline, X, y, cv=cv, scoring='roc_auc')
    
    print(f"\nUsing C={C}, class_weight={class_weight}")
    print(f"\nMetrics across {n_folds} folds:")
    print(f"  Accuracy:         {accuracy_scores.mean():.4f} (+/- {accuracy_scores.std()*2:.4f})")
    print(f"  Weighted F1:      {f1_weighted_scores.mean():.4f} (+/- {f1_weighted_scores.std()*2:.4f})")
    print(f"  Macro F1:         {f1_macro_scores.mean():.4f} (+/- {f1_macro_scores.std()*2:.4f})")
    print(f"  ROC-AUC:          {roc_auc_scores.mean():.4f} (+/- {roc_auc_scores.std()*2:.4f})")
    
    return {
        'accuracy': accuracy_scores.mean(),
        'f1_weighted': f1_weighted_scores.mean(),
        'f1_macro': f1_macro_scores.mean(),
        'roc_auc': roc_auc_scores.mean()
    }


def train_final_model(X: np.ndarray, y: np.ndarray, C: float = 1.0, class_weight=None) -> Pipeline:
    """
    Train the final model on all data for production use.
    
    Args:
        X: Feature matrix
        y: Labels
        C: Regularization parameter (from hyperparameter tuning)
        class_weight: Class weight parameter (from hyperparameter tuning)
    
    Returns:
        Trained pipeline (scaler + classifier)
    """
    print(f"\n{'='*60}")
    print("Training Final Model")
    print('='*60)
    
    # Create pipeline: StandardScaler + LogisticRegression
    # Uses tuned hyperparameters from GridSearchCV
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('classifier', LogisticRegression(
            max_iter=1000,
            C=C,
            random_state=42,
            solver='lbfgs',
            class_weight=class_weight
        ))
    ])
    
    # Train on all data
    print(f"\nTraining on {len(X)} samples with C={C}, class_weight={class_weight}...")
    pipeline.fit(X, y)
    
    # Report training accuracy
    y_pred = pipeline.predict(X)
    y_proba = pipeline.predict_proba(X)[:, 1]
    
    train_accuracy = accuracy_score(y, y_pred)
    train_f1 = f1_score(y, y_pred, average='weighted')
    train_auc = roc_auc_score(y, y_proba)
    
    print(f"Training Accuracy: {train_accuracy:.4f}")
    print(f"Training F1 (weighted): {train_f1:.4f}")
    print(f"Training ROC-AUC: {train_auc:.4f}")
    
    return pipeline


def evaluate_holdout(X: np.ndarray, y: np.ndarray, test_size: float = 0.2):
    """
    Evaluate on a held-out test set for final performance estimate.
    
    Args:
        X: Feature matrix
        y: Labels
        test_size: Fraction of data to use for testing
    """
    print(f"\n{'='*60}")
    print(f"Hold-out Evaluation ({int((1-test_size)*100)}/{int(test_size*100)} split)")
    print('='*60)
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=y
    )
    
    print(f"Train samples: {len(X_train)}")
    print(f"Test samples: {len(X_test)}")
    
    # Train
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('classifier', LogisticRegression(max_iter=500, C=1.0, random_state=42))
    ])
    pipeline.fit(X_train, y_train)
    
    # Predict
    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]
    
    # Metrics
    print(f"\nTest Set Results:")
    print(f"  Accuracy:    {accuracy_score(y_test, y_pred):.4f}")
    print(f"  F1 Weighted: {f1_score(y_test, y_pred, average='weighted'):.4f}")
    print(f"  F1 Macro:    {f1_score(y_test, y_pred, average='macro'):.4f}")
    print(f"  ROC-AUC:     {roc_auc_score(y_test, y_proba):.4f}")
    
    print(f"\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=['Non-Sarcastic', 'Sarcastic']))
    
    print(f"\nConfusion Matrix:")
    cm = confusion_matrix(y_test, y_pred)
    print(f"  [[TN={cm[0,0]:3d}  FP={cm[0,1]:3d}]")
    print(f"   [FN={cm[1,0]:3d}  TP={cm[1,1]:3d}]]")


def test_predictions(pipeline: Pipeline, df: pd.DataFrame, n_samples: int = 5):
    """
    Show example predictions for qualitative evaluation.
    
    Args:
        pipeline: Trained model pipeline
        df: DataFrame with utterances and embeddings
        n_samples: Number of samples to show per class
    """
    print(f"\n{'='*60}")
    print("Sample Predictions")
    print('='*60)
    
    # Get some sarcastic and non-sarcastic samples
    sarcastic_df = df[df['label'] == 1].sample(n=min(n_samples, (df['label']==1).sum()), random_state=42)
    non_sarcastic_df = df[df['label'] == 0].sample(n=min(n_samples, (df['label']==0).sum()), random_state=42)
    
    print("\n--- Sarcastic Samples (should have high scores) ---")
    for _, row in sarcastic_df.iterrows():
        embedding = np.load(resolve_path(row['embedding_path'])).reshape(1, -1)
        score = pipeline.predict_proba(embedding)[0, 1]
        utterance = row['utterance'][:60] + "..." if len(row['utterance']) > 60 else row['utterance']
        print(f"  [{score:.3f}] \"{utterance}\"")
    
    print("\n--- Non-Sarcastic Samples (should have low scores) ---")
    for _, row in non_sarcastic_df.iterrows():
        embedding = np.load(resolve_path(row['embedding_path'])).reshape(1, -1)
        score = pipeline.predict_proba(embedding)[0, 1]
        utterance = row['utterance'][:60] + "..." if len(row['utterance']) > 60 else row['utterance']
        print(f"  [{score:.3f}] \"{utterance}\"")


def main():
    print("=" * 60)
    print("Prosodic Sarcasm Detection - Model Training")
    print("=" * 60)
    
    # Check if index exists
    if not INDEX_PATH.exists():
        print(f"✗ Index file not found: {INDEX_PATH}")
        print("  Please run mustard_embeddings.py first")
        return
    
    # Load index
    print(f"\nLoading index from {INDEX_PATH}...")
    df = pd.read_csv(INDEX_PATH)
    
    # Filter to samples with valid embeddings (handles both relative and absolute paths)
    df = df[df['embedding_path'].notna()]
    df = df[df['embedding_path'].apply(lambda p: resolve_path(p).exists())]
    
    print(f"✓ Loaded {len(df)} samples with embeddings")
    print(f"  Sarcastic: {(df['label'] == 1).sum()}")
    print(f"  Non-sarcastic: {(df['label'] == 0).sum()}")
    
    if len(df) < 10:
        print("✗ Not enough samples to train a model")
        return
    
    # Load embeddings
    print("\nLoading embeddings...")
    X, y = load_embeddings(df)
    print(f"✓ Loaded embeddings: shape {X.shape}")
    
    # Tune hyperparameters with GridSearchCV
    best_params, best_score = tune_hyperparameters(X, y, n_folds=5)
    
    # Extract best hyperparameters
    best_C = best_params['classifier__C']
    best_class_weight = best_params['classifier__class_weight']
    
    # Evaluate with cross-validation using tuned hyperparameters
    cv_scores = evaluate_with_cross_validation(X, y, n_folds=5, C=best_C, class_weight=best_class_weight)
    
    # Evaluate on hold-out set
    evaluate_holdout(X, y, test_size=0.2)
    
    # Train final model on all data with tuned hyperparameters
    pipeline = train_final_model(X, y, C=best_C, class_weight=best_class_weight)
    
    # Show sample predictions
    test_predictions(pipeline, df)
    
    # Save model to backend folder
    print(f"\n{'='*60}")
    print("Saving Model")
    print('='*60)
    
    OUTPUT_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_MODEL_PATH, 'wb') as f:
        pickle.dump(pipeline, f)
    print(f"✓ Model saved to: {OUTPUT_MODEL_PATH}")
    
    # Print model size
    model_size_kb = OUTPUT_MODEL_PATH.stat().st_size / 1024
    print(f"  Model size: {model_size_kb:.1f} KB")
    
    print("\n" + "=" * 60)
    print("Training complete!")
    print("=" * 60)
    print(f"\nThe prosodic model has been saved to the backend folder.")
    print(f"Update backend/app.py to load and use this model.")
    print(f"\nExpected performance (5-fold CV):")
    print(f"  Weighted F1: {cv_scores['f1_weighted']:.4f}")
    print(f"  ROC-AUC: {cv_scores['roc_auc']:.4f}")


if __name__ == "__main__":
    main()

