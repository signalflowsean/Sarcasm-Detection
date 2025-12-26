"""
Multi-Dataset Sarcasm Detection Model Training

Combines multiple sarcasm datasets for better generalization:
1. News Headlines (original) - formal sarcasm
2. SARC (Reddit) - conversational sarcasm
3. iSarcasm (Twitter) - social media sarcasm

Run: python train_multi_dataset.py

Setup:
1. Download SARC: https://nlp.cs.princeton.edu/SARC/
   - Download train-balanced.csv and test-balanced.csv
   - Place in ./data/sarc/

2. (Optional) Download iSarcasm: https://github.com/Lopezsec/iSarcasm
   - Place isarcasm_train.csv and isarcasm_test.csv in ./data/isarcasm/
"""

import json
import pickle
import urllib.request
import pandas as pd
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import warnings

warnings.filterwarnings("ignore")

# =============================================================================
# Configuration
# =============================================================================

RANDOM_STATE = 42
DATA_DIR = Path("./data")

# =============================================================================
# Dataset Loaders
# =============================================================================


def load_news_headlines():
    """Load the original news headlines dataset (The Onion vs HuffPost)."""
    url = "https://storage.googleapis.com/learning-datasets/sarcasm.json"
    output_path = "/tmp/sarcasm.json"

    print("📰 Loading News Headlines dataset...")
    urllib.request.urlretrieve(url, output_path)

    with open(output_path, "r") as f:
        datastore = json.load(f)

    texts = [item["headline"] for item in datastore]
    labels = [item["is_sarcastic"] for item in datastore]

    print(f"   Loaded {len(texts):,} samples (Sarcastic: {sum(labels):,})")
    return texts, labels


def load_sarc_dataset():
    """
    Load SARC (Self-Annotated Reddit Corpus) dataset.

    Download from: https://nlp.cs.princeton.edu/SARC/
    Files needed: train-balanced.csv, test-balanced.csv
    Place in: ./data/sarc/
    """
    sarc_dir = DATA_DIR / "sarc"
    train_file = sarc_dir / "train-balanced.csv"
    test_file = sarc_dir / "test-balanced.csv"

    if not train_file.exists():
        print("📁 SARC dataset not found. To use it:")
        print("   1. Download from: https://nlp.cs.princeton.edu/SARC/")
        print("   2. Place train-balanced.csv in ./data/sarc/")
        return [], []

    print("💬 Loading SARC (Reddit) dataset...")

    texts, labels = [], []

    # Load training data
    try:
        # SARC format: label, comment, parent_comment, ...
        df_train = pd.read_csv(
            train_file,
            header=None,
            usecols=[0, 1],
            names=["label", "comment"],
            nrows=100000,
        )  # Limit for memory

        for _, row in df_train.iterrows():
            if pd.notna(row["comment"]) and len(str(row["comment"]).strip()) > 5:
                texts.append(str(row["comment"]).strip())
                labels.append(int(row["label"]))

        print(f"   Loaded {len(texts):,} samples (Sarcastic: {sum(labels):,})")

    except Exception as e:
        print(f"   Error loading SARC: {e}")
        return [], []

    return texts, labels


def load_isarcasm_dataset():
    """
    Load iSarcasm dataset (Twitter, author-labeled).

    Download from: https://github.com/Lopezsec/iSarcasm
    Files needed: isarcasm_train.csv, isarcasm_test.csv
    Place in: ./data/isarcasm/
    """
    isarcasm_dir = DATA_DIR / "isarcasm"
    train_file = isarcasm_dir / "isarcasm_train.csv"

    if not train_file.exists():
        print("📁 iSarcasm dataset not found. To use it:")
        print("   1. Download from: https://github.com/Lopezsec/iSarcasm")
        print("   2. Place isarcasm_train.csv in ./data/isarcasm/")
        return [], []

    print("🐦 Loading iSarcasm (Twitter) dataset...")

    texts, labels = [], []

    try:
        df = pd.read_csv(train_file)

        # Column names may vary - try common ones
        text_col = None
        label_col = None

        for col in ["tweet", "text", "sentence", "comment"]:
            if col in df.columns:
                text_col = col
                break

        for col in ["sarcastic", "label", "is_sarcastic"]:
            if col in df.columns:
                label_col = col
                break

        if text_col and label_col:
            for _, row in df.iterrows():
                if pd.notna(row[text_col]) and len(str(row[text_col]).strip()) > 5:
                    texts.append(str(row[text_col]).strip())
                    labels.append(int(row[label_col]))

            print(f"   Loaded {len(texts):,} samples (Sarcastic: {sum(labels):,})")
        else:
            print(f"   Could not find expected columns. Available: {list(df.columns)}")

    except Exception as e:
        print(f"   Error loading iSarcasm: {e}")
        return [], []

    return texts, labels


def load_custom_conversational():
    """
    Add custom conversational sarcasm examples to improve everyday sarcasm detection.
    These are manually curated examples of common sarcastic patterns.
    """
    print("✨ Adding custom conversational examples...")

    sarcastic_examples = [
        # Classic sarcasm patterns
        "Oh great, another meeting that could have been an email",
        "Wow, thanks for letting me know at the last minute",
        "Oh how wonderful, more homework",
        "Yeah right, like that's going to happen",
        "Sure, I just LOVE waiting in traffic",
        "Oh fantastic, my flight is delayed again",
        "What a surprise, the printer isn't working",
        "Oh joy, another software update",
        "Wonderful, more spam emails",
        "Perfect timing, thanks a lot",
        "Oh brilliant, I forgot my umbrella and now it's raining",
        "Sure, because that's exactly what I needed today",
        "Oh lucky me, stuck behind a slow driver",
        "Great, just what I wanted to hear",
        "Wow, you're SO helpful",
        "Thanks for nothing",
        "Oh yeah, because that makes total sense",
        "Right, because I have nothing better to do",
        "Sure, I'll just drop everything",
        "Oh wonderful, another Monday",
        # Exaggeration patterns
        "I'm SO excited to do this paperwork",
        "This is the BEST day ever",
        "I just LOVE being micromanaged",
        "Nothing I enjoy more than waking up at 5am",
        "My favorite thing is paying bills",
        # Rhetorical/impossible
        "Yeah and I'm the Queen of England",
        "And pigs fly",
        "When hell freezes over",
        "Sure, when monkeys fly out of my butt",
        # Deadpan
        "Shocking. Nobody could have predicted that",
        "Who would have thought",
        "Color me surprised",
        "Well that was unexpected. Not.",
        "I'm shocked. Shocked I tell you",
    ]

    non_sarcastic_examples = [
        # Genuine positive statements
        "Thank you so much for your help today",
        "I really appreciate you taking the time",
        "This is actually really helpful",
        "Great job on the presentation",
        "The weather is lovely today",
        "I enjoyed the movie last night",
        "Thanks for letting me know",
        "I appreciate the feedback",
        "Good morning everyone",
        "Have a nice day",
        "The food was delicious",
        "I'm looking forward to the weekend",
        "Nice to meet you",
        "Thanks for the update",
        "I agree with your point",
        "That's a good idea",
        "The meeting went well",
        "I learned a lot today",
        "Great question",
        "Happy to help",
        # Neutral statements
        "The report is due tomorrow",
        "I'll send you the email",
        "Let me check on that",
        "The system is working now",
        "I'll be there at 3pm",
        "Can you send me the link",
        "I'll review it this afternoon",
        "The deadline is next week",
        "Let me know if you have questions",
        "I'll follow up with them",
    ]

    texts = sarcastic_examples + non_sarcastic_examples
    labels = [1] * len(sarcastic_examples) + [0] * len(non_sarcastic_examples)

    print(
        f"   Added {len(texts)} custom examples ({len(sarcastic_examples)} sarcastic)"
    )

    return texts, labels


# =============================================================================
# Training
# =============================================================================


def train_model(X_train, y_train, X_test, y_test):
    """Train an optimized model on the combined dataset."""

    print("\n🔧 Training model...")

    # Best configuration from hyperparameter tuning
    model = Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    max_features=25000,
                    ngram_range=(1, 3),
                    min_df=2,
                    max_df=0.95,
                    sublinear_tf=True,
                    stop_words="english",
                ),
            ),
            (
                "clf",
                LogisticRegression(
                    max_iter=2000,
                    C=1.5,
                    class_weight="balanced",
                    random_state=RANDOM_STATE,
                    solver="lbfgs",
                ),
            ),
        ]
    )

    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)

    print("\n📊 Model Performance:")
    print(f"   Test Accuracy: {accuracy:.4f} ({accuracy * 100:.2f}%)")
    print("\n   Classification Report:")
    print(
        classification_report(
            y_test, y_pred, target_names=["Not Sarcastic", "Sarcastic"]
        )
    )

    return model, accuracy


def main():
    print("=" * 60)
    print("🎯 MULTI-DATASET SARCASM DETECTION TRAINING")
    print("=" * 60)

    # Create data directory
    DATA_DIR.mkdir(exist_ok=True)
    (DATA_DIR / "sarc").mkdir(exist_ok=True)
    (DATA_DIR / "isarcasm").mkdir(exist_ok=True)

    # Load all datasets
    all_texts = []
    all_labels = []
    dataset_sources = []

    # 1. News Headlines (always available)
    texts, labels = load_news_headlines()
    all_texts.extend(texts)
    all_labels.extend(labels)
    dataset_sources.append(("News Headlines", len(texts)))

    # 2. SARC Reddit (if available)
    texts, labels = load_sarc_dataset()
    if texts:
        all_texts.extend(texts)
        all_labels.extend(labels)
        dataset_sources.append(("SARC Reddit", len(texts)))

    # 3. iSarcasm Twitter (if available)
    texts, labels = load_isarcasm_dataset()
    if texts:
        all_texts.extend(texts)
        all_labels.extend(labels)
        dataset_sources.append(("iSarcasm Twitter", len(texts)))

    # 4. Custom conversational examples (always add)
    texts, labels = load_custom_conversational()
    all_texts.extend(texts)
    all_labels.extend(labels)
    dataset_sources.append(("Custom Examples", len(texts)))

    # Summary
    print("\n" + "=" * 60)
    print("📊 COMBINED DATASET SUMMARY")
    print("=" * 60)

    for source, count in dataset_sources:
        print(f"   {source}: {count:,} samples")

    print(f"\n   Total: {len(all_texts):,} samples")
    print(
        f"   Sarcastic: {sum(all_labels):,} ({sum(all_labels) / len(all_labels) * 100:.1f}%)"
    )
    print(
        f"   Not Sarcastic: {len(all_labels) - sum(all_labels):,} ({(1 - sum(all_labels) / len(all_labels)) * 100:.1f}%)"
    )

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        all_texts,
        all_labels,
        test_size=0.2,
        random_state=RANDOM_STATE,
        stratify=all_labels,
    )

    print(f"\n   Training: {len(X_train):,} | Test: {len(X_test):,}")

    # Train model
    print("\n" + "=" * 60)
    print("🎓 TRAINING")
    print("=" * 60)

    model, accuracy = train_model(X_train, y_train, X_test, y_test)

    # Save model
    from pathlib import Path

    SCRIPT_DIR = Path(__file__).parent
    BACKEND_DIR = SCRIPT_DIR.parent.parent / "backend"
    output_path = BACKEND_DIR / "sarcasm_model.pkl"
    with open(output_path, "wb") as f:
        pickle.dump(model, f)
    print(f"\n💾 Model saved to: {output_path}")

    # Test on conversational examples
    print("\n" + "=" * 60)
    print("🧪 CONVERSATIONAL SARCASM TEST")
    print("=" * 60)

    test_sentences = [
        # Should be sarcastic
        "Oh great, another meeting that could have been an email",
        "Wow, you are SO smart",
        "Sure, I just LOVE doing overtime",
        "Yeah right, like that's ever going to happen",
        "I love waiting in traffic, it's my favorite thing",
        "Oh wonderful, more paperwork",
        # Should NOT be sarcastic
        "Thank you for helping me with my homework",
        "The weather is nice today",
        "I appreciate your feedback",
        "Have a great weekend",
    ]

    print("\n📝 Predictions:")
    for sentence in test_sentences:
        prob = model.predict_proba([sentence])[0][1]
        emoji = "😏" if prob > 0.5 else "😐"
        print(f"   {emoji} [{prob:.3f}] '{sentence}'")

    print("\n" + "=" * 60)
    print("✅ Training Complete!")
    print("=" * 60)

    # Instructions for improving with more data
    if len(dataset_sources) < 4:
        print("\n💡 To improve accuracy further, add more datasets:")
        print("   1. SARC Reddit: https://nlp.cs.princeton.edu/SARC/")
        print("      → Place train-balanced.csv in ./data/sarc/")
        print("   2. iSarcasm: https://github.com/Lopezsec/iSarcasm")
        print("      → Place isarcasm_train.csv in ./data/isarcasm/")


if __name__ == "__main__":
    main()
