# Lexical Sarcasm Detection

Text-based sarcasm detection using various ML approaches.

## Overview

This module provides multiple training scripts for lexical (text-based) sarcasm detection:

| Script | Model | Accuracy | Description |
|--------|-------|----------|-------------|
| `train_sklearn_model.py` | TF-IDF + LogReg | ~80% | Simple, fast, production-ready |
| `train_sklearn_model_improved.py` | Ensemble | ~85% | Hyperparameter tuning, multiple classifiers |
| `train_transformer.py` | **DistilBERT** | **~90%** | **Fine-tuned transformer (recommended for best accuracy)** |
| `train_multi_dataset.py` | TF-IDF + LogReg | ~82% | Multiple dataset sources |
| `train_huggingface.py` | TF-IDF + Multi-data | ~83% | HuggingFace datasets |
| `train_keras.py` | Embedding + Dense | ~82% | TensorFlow/Keras neural network |

## Quick Start

### Install Dependencies

```bash
cd ml/lexical
pip install -r requirements.txt
```

### Train the Production Model

```bash
# Simple sklearn model (fast, ~80% accuracy)
python train_sklearn_model.py

# Improved sklearn with hyperparameter tuning (~85% accuracy)
python train_sklearn_model_improved.py

# DistilBERT transformer (~90% accuracy, requires GPU)
python train_transformer.py --epochs 3
```

The sklearn models are saved to `backend/sarcasm_model.pkl`.
The transformer model is saved to `ml/lexical/distilbert_sarcasm/`.

### Fine-tune DistilBERT (Best Accuracy)

For best results, fine-tune DistilBERT (requires GPU or Apple Silicon):

```bash
# Basic training (3 epochs)
python train_transformer.py

# More epochs for better accuracy
python train_transformer.py --epochs 5

# Export to ONNX for faster inference
python train_transformer.py --export-onnx
```

**Training time:**
- NVIDIA GPU: ~5-10 minutes
- Apple M1/M2: ~15-30 minutes  
- CPU: ~1-2 hours (not recommended)

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

| Model | Accuracy | F1 Score | Size | Inference |
|-------|----------|----------|------|-----------|
| TF-IDF + LogReg | ~80% | ~0.80 | ~5 MB | <1ms |
| TF-IDF + Ensemble | ~85% | ~0.85 | ~15 MB | <5ms |
| Keras Embedding | ~82% | ~0.82 | ~2 MB | ~10ms |
| **DistilBERT Fine-tuned** | **~90%** | **~0.90** | ~250 MB | ~50ms |

Note: Results on news headlines dataset. Conversational sarcasm is harder to detect.

**Recommendation:**
- **Production (speed priority)**: Use sklearn (`train_sklearn_model_improved.py`)
- **Production (accuracy priority)**: Use DistilBERT (`train_transformer.py`) with ONNX export

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

