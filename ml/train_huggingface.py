"""
Sarcasm Detection Training with HuggingFace Datasets

Uses multiple sarcasm datasets from HuggingFace for better generalization:
1. News Headlines - formal/news sarcasm
2. Twitter sarcasm datasets - social media sarcasm
3. Custom conversational examples - everyday sarcasm

Run: python train_huggingface.py
"""

import json
import pickle
import urllib.request
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split, RandomizedSearchCV, StratifiedKFold
from sklearn.metrics import accuracy_score, classification_report
import warnings
warnings.filterwarnings('ignore')

# =============================================================================
# Configuration
# =============================================================================

RANDOM_STATE = 42

# =============================================================================
# Dataset Loaders
# =============================================================================

def load_news_headlines():
    """Load the original news headlines dataset."""
    url = "https://storage.googleapis.com/learning-datasets/sarcasm.json"
    output_path = "/tmp/sarcasm.json"
    
    print("📰 Loading News Headlines dataset...")
    urllib.request.urlretrieve(url, output_path)
    
    with open(output_path, 'r') as f:
        datastore = json.load(f)
    
    texts = [item['headline'] for item in datastore]
    labels = [item['is_sarcastic'] for item in datastore]
    
    print(f"   Loaded {len(texts):,} samples (Sarcastic: {sum(labels):,})")
    return texts, labels


def load_huggingface_sarcasm():
    """Load sarcasm datasets from HuggingFace."""
    try:
        from datasets import load_dataset
        
        print("🤗 Loading HuggingFace sarcasm datasets...")
        
        all_texts = []
        all_labels = []
        
        # Try loading different sarcasm datasets
        datasets_to_try = [
            ("helinivan/english-sarcasm-detector", None),
            ("raquiba/Sarcasm_News_Headline", None),
        ]
        
        for dataset_name, config in datasets_to_try:
            try:
                print(f"   Trying {dataset_name}...")
                if config:
                    ds = load_dataset(dataset_name, config, trust_remote_code=True)
                else:
                    ds = load_dataset(dataset_name, trust_remote_code=True)
                
                # Get train split
                if 'train' in ds:
                    train_data = ds['train']
                else:
                    train_data = ds[list(ds.keys())[0]]
                
                # Find text and label columns
                text_cols = ['text', 'headline', 'tweet', 'sentence', 'comment']
                label_cols = ['label', 'is_sarcastic', 'sarcastic', 'sarcasm']
                
                text_col = None
                label_col = None
                
                for col in text_cols:
                    if col in train_data.features:
                        text_col = col
                        break
                
                for col in label_cols:
                    if col in train_data.features:
                        label_col = col
                        break
                
                if text_col and label_col:
                    for item in train_data:
                        text = str(item[text_col]).strip()
                        if len(text) > 5:
                            all_texts.append(text)
                            all_labels.append(int(item[label_col]))
                    
                    print(f"   ✓ Loaded {len(train_data):,} from {dataset_name}")
                else:
                    print(f"   ✗ Could not find expected columns in {dataset_name}")
                    
            except Exception as e:
                print(f"   ✗ Failed to load {dataset_name}: {str(e)[:50]}")
        
        return all_texts, all_labels
        
    except ImportError:
        print("   HuggingFace datasets not installed")
        return [], []


def load_conversational_sarcasm():
    """
    Curated conversational sarcasm examples.
    These are common patterns that the news headlines dataset misses.
    """
    print("💬 Loading conversational sarcasm examples...")
    
    # Sarcastic patterns (with variations)
    sarcastic = [
        # "Oh [adjective]" pattern
        "Oh great, another meeting",
        "Oh great, another meeting that could have been an email",
        "Oh great, more homework",
        "Oh wonderful, my coffee is cold",
        "Oh fantastic, my bus is late",
        "Oh perfect, it's raining and I forgot my umbrella",
        "Oh joy, another Monday",
        "Oh brilliant, the printer is jammed again",
        "Oh lovely, stuck in traffic",
        "Oh nice, another email from the boss",
        "Oh super, more paperwork",
        
        # "Yeah right" / "Sure" patterns
        "Yeah right, like that's going to happen",
        "Yeah right, as if",
        "Sure, because that makes total sense",
        "Sure, I'll just drop everything for you",
        "Sure, because I have nothing better to do",
        "Right, because that's so important",
        "Of course, because you're always right",
        
        # "I just LOVE" / exaggeration patterns  
        "I just LOVE waiting in lines",
        "I just LOVE being ignored",
        "I LOVE when people are late",
        "I SO enjoy doing extra work",
        "I absolutely LOVE doing overtime",
        "Nothing I enjoy more than being stuck in traffic",
        "What I really wanted was more problems",
        "This is exactly what I needed today",
        "Just what I always wanted",
        
        # "Wow" sarcasm
        "Wow, you're SO smart",
        "Wow, thanks for letting me know at the last minute",
        "Wow, what a surprise",
        "Wow, how original",
        "Wow, never heard that one before",
        "Wow, you're so helpful",
        "Wow, that's amazing. Really.",
        
        # Deadpan/dry sarcasm
        "Shocking. Nobody could have predicted that",
        "Well that was unexpected. Not.",
        "Color me surprised",
        "I'm shocked, absolutely shocked",
        "Who would have thought",
        "What a revelation",
        "How surprising",
        "Tell me something I don't know",
        
        # Self-deprecating/situation sarcasm
        "Best day ever, clearly",
        "Living the dream over here",
        "Everything is fine. Just fine.",
        "Having the time of my life",
        "Couldn't be better",
        "This is going swimmingly",
        
        # Fake gratitude
        "Thanks for nothing",
        "Thanks a lot, really appreciate it",
        "Gee thanks",
        "Much appreciated. Really.",
        
        # Rhetorical impossibilities
        "And I'm the Queen of England",
        "Sure, and pigs fly",
        "Yeah, when hell freezes over",
        "That'll happen when pigs fly",
        
        # News headline style (to reinforce original dataset)
        "Man shocked his lottery numbers didn't win again",
        "Employee surprised boss wants unpaid overtime",
        "Scientists confirm water is wet",
        "Study finds people like being happy",
        "Breaking: Thing that always happens happened again",
        "Local man confident he'll start exercising tomorrow",
        "Area woman certain this diet will be different",
    ]
    
    # Non-sarcastic examples (genuine statements)
    non_sarcastic = [
        # Genuine thanks/appreciation
        "Thank you so much for your help",
        "I really appreciate you taking the time",
        "Thanks for letting me know",
        "Thank you for the feedback",
        "I'm grateful for your support",
        "Thanks for being patient with me",
        "I appreciate your understanding",
        
        # Genuine positive statements
        "This is actually really helpful",
        "Great job on the presentation",
        "The food was delicious",
        "I enjoyed the movie",
        "Nice work on that project",
        "Well done, that was impressive",
        "I'm happy with the results",
        
        # Neutral factual statements
        "The weather is nice today",
        "The meeting is at 3pm",
        "I'll send you the email",
        "Let me check on that",
        "The report is due tomorrow",
        "I'll be there in an hour",
        "The deadline is next week",
        "Let me know if you need anything",
        
        # Genuine questions/interest
        "How was your weekend",
        "Did you have a good trip",
        "How's the project going",
        "What do you think about this",
        
        # Genuine greetings/pleasantries
        "Good morning everyone",
        "Have a great weekend",
        "Nice to meet you",
        "Hope you feel better soon",
        "Happy birthday",
        "Congratulations on the promotion",
        
        # Genuine excitement
        "I can't wait for the vacation",
        "Looking forward to the concert",
        "So excited about the new project",
        "This is going to be great",
        
        # Professional/work statements
        "The system is working properly now",
        "I'll follow up with them tomorrow",
        "The issue has been resolved",
        "We're making good progress",
        "The team did excellent work",
    ]
    
    texts = sarcastic + non_sarcastic
    labels = [1] * len(sarcastic) + [0] * len(non_sarcastic)
    
    print(f"   Loaded {len(texts)} examples ({len(sarcastic)} sarcastic)")
    return texts, labels


# =============================================================================
# Training
# =============================================================================

def train_optimized_model(X_train, y_train):
    """Train with hyperparameter tuning."""
    
    print("\n🔧 Training with hyperparameter tuning...")
    
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer()),
        ('clf', LogisticRegression(max_iter=2000, random_state=RANDOM_STATE))
    ])
    
    param_dist = {
        'tfidf__max_features': [15000, 20000, 25000],
        'tfidf__ngram_range': [(1, 2), (1, 3)],
        'tfidf__sublinear_tf': [True, False],
        'tfidf__min_df': [1, 2],
        'tfidf__max_df': [0.9, 0.95],
        'clf__C': [0.5, 1.0, 1.5, 2.0],
        'clf__class_weight': [None, 'balanced'],
    }
    
    search = RandomizedSearchCV(
        pipeline,
        param_distributions=param_dist,
        n_iter=25,
        cv=StratifiedKFold(n_splits=3, shuffle=True, random_state=RANDOM_STATE),
        scoring='accuracy',
        n_jobs=-1,
        verbose=1,
        random_state=RANDOM_STATE
    )
    
    search.fit(X_train, y_train)
    
    print(f"\n   Best CV Accuracy: {search.best_score_:.4f}")
    print(f"   Best params: {search.best_params_}")
    
    return search.best_estimator_


def main():
    print("=" * 60)
    print("🎯 SARCASM DETECTION - HUGGINGFACE + CONVERSATIONAL")
    print("=" * 60)
    
    # Collect all data
    all_texts = []
    all_labels = []
    
    # 1. News Headlines (base dataset)
    texts, labels = load_news_headlines()
    all_texts.extend(texts)
    all_labels.extend(labels)
    
    # 2. HuggingFace datasets (if available)
    texts, labels = load_huggingface_sarcasm()
    if texts:
        all_texts.extend(texts)
        all_labels.extend(labels)
    
    # 3. Conversational examples (weighted more heavily by repetition)
    texts, labels = load_conversational_sarcasm()
    # Add conversational examples multiple times to give them more weight
    for _ in range(5):  # 5x weight
        all_texts.extend(texts)
        all_labels.extend(labels)
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 DATASET SUMMARY")
    print("=" * 60)
    print(f"   Total samples: {len(all_texts):,}")
    print(f"   Sarcastic: {sum(all_labels):,} ({sum(all_labels)/len(all_labels)*100:.1f}%)")
    print(f"   Not Sarcastic: {len(all_labels)-sum(all_labels):,}")
    
    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        all_texts, all_labels,
        test_size=0.2,
        random_state=RANDOM_STATE,
        stratify=all_labels
    )
    
    print(f"\n   Training: {len(X_train):,} | Test: {len(X_test):,}")
    
    # Train
    print("\n" + "=" * 60)
    print("🎓 TRAINING")
    print("=" * 60)
    
    model = train_optimized_model(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    
    print(f"\n📊 Final Test Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
    print("\n   Classification Report:")
    print(classification_report(y_test, y_pred, target_names=['Not Sarcastic', 'Sarcastic']))
    
    # Save
    output_path = '../backend/sarcasm_model.pkl'
    with open(output_path, 'wb') as f:
        pickle.dump(model, f)
    print(f"\n💾 Model saved to: {output_path}")
    
    # Test conversational sarcasm
    print("\n" + "=" * 60)
    print("🧪 CONVERSATIONAL SARCASM TEST")
    print("=" * 60)
    
    test_cases = [
        # Should be SARCASTIC
        ("Oh great, another meeting", True),
        ("Wow, you're SO smart", True),
        ("Sure, I just LOVE doing overtime", True),
        ("Yeah right, like that's ever going to happen", True),
        ("I love waiting in traffic, it's my favorite thing", True),
        ("What a surprise", True),
        ("Thanks for nothing", True),
        ("Living the dream over here", True),
        
        # Should be NOT SARCASTIC
        ("Thank you for helping me", False),
        ("The weather is nice today", False),
        ("Have a great weekend", False),
        ("I appreciate your feedback", False),
        ("Looking forward to the meeting", False),
        ("Nice work on that project", False),
    ]
    
    print("\n📝 Predictions (✓ = correct, ✗ = wrong):")
    correct = 0
    for text, expected_sarcastic in test_cases:
        prob = model.predict_proba([text])[0][1]
        predicted_sarcastic = prob > 0.5
        is_correct = predicted_sarcastic == expected_sarcastic
        correct += is_correct
        
        emoji = "😏" if predicted_sarcastic else "😐"
        marker = "✓" if is_correct else "✗"
        expected = "Sarcastic" if expected_sarcastic else "Not Sarcastic"
        
        print(f"   {marker} {emoji} [{prob:.3f}] '{text[:50]}' (expected: {expected})")
    
    print(f"\n   Conversational accuracy: {correct}/{len(test_cases)} ({correct/len(test_cases)*100:.0f}%)")
    
    print("\n" + "=" * 60)
    print("✅ Training Complete!")
    print("=" * 60)


if __name__ == '__main__':
    main()

