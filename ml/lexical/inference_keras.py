"""
Lexical Sarcasm Detection - Keras Model Inference

Standalone script for testing the TensorFlow/Keras model.
Note: The primary production model uses sklearn (see inference.py).

Usage:
    python inference_keras.py "Your text here"
    python inference_keras.py "Text 1" "Text 2"
"""

import sys
import argparse
from pathlib import Path
import tensorflow as tf
from tensorflow import keras

# Paths
SCRIPT_DIR = Path(__file__).parent
MODEL_PATH = SCRIPT_DIR / 'sarcasm_model.keras'


def load_model():
    """Load the trained Keras model."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found at {MODEL_PATH}. Run train_keras.py first."
        )
    
    return keras.models.load_model(MODEL_PATH)


def predict(model, texts: list[str]) -> list[dict]:
    """
    Predict sarcasm scores for a list of texts.
    
    Args:
        model: Trained Keras model
        texts: List of text strings
        
    Returns:
        List of dicts with 'text', 'score', 'label'
    """
    sentences_tensor = tf.constant(texts)
    predictions = model.predict(sentences_tensor, verbose=0)
    
    results = []
    for text, pred in zip(texts, predictions):
        score = float(pred[0])
        label = "Sarcastic" if score > 0.5 else "Not Sarcastic"
        results.append({
            'text': text,
            'score': score,
            'label': label
        })
    
    return results


def main():
    parser = argparse.ArgumentParser(
        description="Predict sarcasm score using Keras model"
    )
    parser.add_argument(
        "texts",
        nargs="*",
        help="Text(s) to analyze for sarcasm"
    )
    args = parser.parse_args()
    
    if not args.texts:
        # Default test sentences
        args.texts = [
            "granny starting to fear spiders in the garden might be real",
            "the dog has really soft fur and is very friendly",
            "Oh great, another meeting that could have been an email",
        ]
    
    # Load model
    print("Loading Keras model...")
    model = load_model()
    
    # Predict
    print("\n" + "=" * 60)
    print("Lexical Sarcasm Detection (Keras)")
    print("=" * 60 + "\n")
    
    results = predict(model, args.texts)
    
    for result in results:
        text_preview = result['text'][:60] + "..." if len(result['text']) > 60 else result['text']
        print(f"[{result['score']:.3f}] \"{text_preview}\"")
        print(f"         → {result['label']}")
        print()


if __name__ == "__main__":
    main()
