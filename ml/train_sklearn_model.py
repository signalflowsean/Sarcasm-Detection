"""
Train a scikit-learn text classification model for sarcasm detection.
Uses TF-IDF + LogisticRegression - industry standard for text classification.
Saves as pickle for lightweight deployment.
"""

import urllib.request
import json
import pickle
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

# Download the sarcasm dataset
url = "https://storage.googleapis.com/learning-datasets/sarcasm.json"
output_path = "/tmp/sarcasm.json"
print("Downloading dataset...")
urllib.request.urlretrieve(url, output_path)

# Load data
with open("/tmp/sarcasm.json", 'r') as f:
    datastore = json.load(f)

sentences = [item['headline'] for item in datastore]
labels = [item['is_sarcastic'] for item in datastore]

print(f"Total samples: {len(sentences)}")

# Split data
X_train, X_test, y_train, y_test = train_test_split(
    sentences, labels, test_size=0.2, random_state=42
)

print(f"Training samples: {len(X_train)}")
print(f"Test samples: {len(X_test)}")

# Create pipeline: TF-IDF vectorizer + Logistic Regression
# This is the industry-standard approach for text classification
model = Pipeline([
    ('tfidf', TfidfVectorizer(
        max_features=10000,  # Vocabulary size
        ngram_range=(1, 2),  # Unigrams and bigrams
        stop_words='english',
        min_df=2,  # Ignore rare terms
    )),
    ('classifier', LogisticRegression(
        max_iter=1000,
        C=1.0,
        random_state=42
    ))
])

# Train
print("\nTraining model...")
model.fit(X_train, y_train)

# Evaluate
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"\nTest Accuracy: {accuracy:.4f}")
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=['Not Sarcastic', 'Sarcastic']))

# Save model to backend folder
output_path = '../backend/sarcasm_model.pkl'
with open(output_path, 'wb') as f:
    pickle.dump(model, f)
print(f"\nModel saved to: {output_path}")

# Test predictions
print("\n--- Test Predictions ---")
test_sentences = [
    "Oh great, another meeting that could have been an email",
    "Wow, you are SO smart, I cannot believe how intelligent you are",
    "Thank you for helping me with my homework, I really appreciate it",
    "The weather is nice today",
    "Yeah right, like that's ever going to happen",
]

for sentence in test_sentences:
    prob = model.predict_proba([sentence])[0][1]  # Probability of sarcastic
    label = "Sarcastic" if prob > 0.5 else "Not Sarcastic"
    print(f"  '{sentence[:50]}...' -> {prob:.4f} ({label})")

