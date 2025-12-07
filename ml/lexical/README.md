# Lexical Sarcasm Detection

Text-based sarcasm detection using various ML approaches.

## Overview

This module provides multiple training scripts for lexical (text-based) sarcasm detection:

| Script | Model | Description |
|--------|-------|-------------|
| `train_sklearn_model.py` | TF-IDF + LogReg | Simple, fast, production-ready |
| `train_sklearn_model_improved.py` | Ensemble | Hyperparameter tuning, multiple classifiers |
| `train_multi_dataset.py` | TF-IDF + LogReg | Multiple dataset sources |
| `train_huggingface.py` | BERT/Transformers | State-of-the-art accuracy |
| `train_keras.py` | Embedding + Dense | TensorFlow/Keras neural network |

## Quick Start

### Install Dependencies

```bash
cd ml/lexical
pip install -r requirements.txt
```

### Train the Production Model

```bash
# Simple sklearn model (recommended for production)
python train_sklearn_model.py

# Or improved version with hyperparameter tuning
python train_sklearn_model_improved.py
```

The model is saved to `backend/sarcasm_model.pkl`.

### Test Inference

```bash
# Using sklearn model
python inference.py "Oh great, another meeting"

# Using Keras model
python inference_keras.py "Wow, what a surprise"
```

## Directory Structure

```
ml/lexical/
├── data/
│   ├── isarcasm/              # iSarcasm dataset
│   └── reddit/                # Reddit sarcasm data
├── train_sklearn_model.py     # Simple TF-IDF + LogReg
├── train_sklearn_model_improved.py  # With hyperparameter tuning
├── train_multi_dataset.py     # Multi-dataset training
├── train_huggingface.py       # BERT/Transformers
├── train_keras.py             # TensorFlow/Keras
├── inference.py               # sklearn inference utility
├── inference_keras.py         # Keras inference utility
├── sarcasm_model.keras        # Saved Keras model
├── sarcasm_model_improved.pkl # Backup sklearn model
├── vocabulary.json            # Keras tokenizer vocab
├── vectorizer_config.json     # Keras vectorizer config
├── vecs.tsv / meta.tsv        # Embedding projector files
├── requirements.txt           # Python dependencies
└── README.md                  # This file
```

## Model Architectures

### sklearn Pipeline (Production)

```
Text Input
    │
    ▼
┌─────────────────────────────┐
│  TF-IDF Vectorizer          │
│  - max_features: 10,000     │
│  - ngram_range: (1, 2)      │
│  - stop_words: english      │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  Logistic Regression        │
│  - C: 1.0                   │
│  - max_iter: 1000           │
└─────────────────────────────┘
    │
    ▼
Score: [0.0, 1.0]
```

### Keras Model

```
Text Input
    │
    ▼
┌─────────────────────────────┐
│  TextVectorization          │
│  - vocab_size: 10,000       │
│  - max_length: 100          │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  Embedding Layer            │
│  - dim: 16                  │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  GlobalAveragePooling1D     │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  Dense(24, relu)            │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  Dense(1, sigmoid)          │
└─────────────────────────────┘
    │
    ▼
Score: [0.0, 1.0]
```

## Training Data

### Primary Dataset (News Headlines)

- **Source**: [Sarcasm Headlines Dataset](https://www.kaggle.com/rmisra/news-headlines-dataset-for-sarcasm-detection)
- **Size**: ~26,000 headlines
- **Content**: The Onion (sarcastic) + HuffPost (non-sarcastic)

### Additional Datasets

- **iSarcasm**: Twitter sarcasm with intended/perceived labels
- **Reddit**: SARC dataset from Reddit comments

## Expected Performance

| Model | Accuracy | F1 Score |
|-------|----------|----------|
| TF-IDF + LogReg | ~85% | ~0.85 |
| TF-IDF + Ensemble | ~87% | ~0.87 |
| Keras Embedding | ~82% | ~0.82 |
| BERT Fine-tuned | ~89% | ~0.89 |

Note: Results on news headlines dataset. Conversational sarcasm is harder to detect.

## API Integration

The trained sklearn model is loaded by the Flask backend (`backend/app.py`):

```python
# POST /api/lexical
# Content-Type: application/json
# Body: { "text": "Your text here" }

# Response:
{
    "id": "uuid",
    "value": 0.0-1.0  # sarcasm score
}
```

## References

- [Sarcasm Headlines Dataset](https://www.kaggle.com/rmisra/news-headlines-dataset-for-sarcasm-detection)
- [iSarcasm Dataset](https://github.com/silviu-oprea/iSarcasm)
- [SARC Reddit Dataset](https://nlp.cs.princeton.edu/SARC/)

