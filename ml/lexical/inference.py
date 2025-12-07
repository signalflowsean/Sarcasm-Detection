"""
Lexical Sarcasm Detection - Inference Utility

Standalone script for testing text-based sarcasm detection.
Uses the sklearn model (TF-IDF + LogisticRegression) saved in backend/.

Usage:
    python inference.py "Your text here"
    python inference.py "Text 1" "Text 2" "Text 3"
    echo "Some text" | python inference.py --stdin
"""

import argparse
import pickle
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent.parent / "backend"
MODEL_PATH = BACKEND_DIR / "sarcasm_model.pkl"


def load_model():
    """Load the trained sklearn model."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found at {MODEL_PATH}. Run train_sklearn_model.py first."
        )
    
    with open(MODEL_PATH, 'rb') as f:
        model = pickle.load(f)
    
    return model


def predict(model, texts: list[str]) -> list[dict]:
    """
    Predict sarcasm scores for a list of texts.
    
    Args:
        model: Trained sklearn pipeline
        texts: List of text strings
        
    Returns:
        List of dicts with 'text', 'score', 'label'
    """
    results = []
    
    for text in texts:
        score = model.predict_proba([text])[0][1]
        label = "Sarcastic" if score > 0.5 else "Not Sarcastic"
        
        results.append({
            'text': text,
            'score': score,
            'label': label
        })
    
    return results


def main():
    parser = argparse.ArgumentParser(
        description="Predict sarcasm score for text"
    )
    parser.add_argument(
        "texts",
        nargs="*",
        help="Text(s) to analyze for sarcasm"
    )
    parser.add_argument(
        "--stdin",
        action="store_true",
        help="Read text from stdin"
    )
    args = parser.parse_args()
    
    # Collect texts
    texts = list(args.texts)
    
    if args.stdin:
        stdin_text = sys.stdin.read().strip()
        if stdin_text:
            texts.append(stdin_text)
    
    if not texts:
        parser.print_help()
        sys.exit(1)
    
    # Load model
    print("Loading model...")
    model = load_model()
    
    # Predict
    print("\n" + "=" * 60)
    print("Lexical Sarcasm Detection")
    print("=" * 60 + "\n")
    
    results = predict(model, texts)
    
    for result in results:
        text_preview = result['text'][:60] + "..." if len(result['text']) > 60 else result['text']
        print(f"[{result['score']:.3f}] \"{text_preview}\"")
        print(f"         → {result['label']}")
        print()


if __name__ == "__main__":
    main()

