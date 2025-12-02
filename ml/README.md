# Sarcasm Detection ML Model

TensorFlow/Keras-based machine learning model for lexical (text-based) sarcasm detection.

## Overview

This model uses natural language processing to detect sarcasm in text, trained on the [News Headlines Dataset for Sarcasm Detection](https://www.kaggle.com/rmisra/news-headlines-dataset-for-sarcasm-detection).

## Model Architecture

```
┌──────────────────────────────────────────────┐
│          TextVectorization Layer             │
│        (vocab_size: 10,000 tokens)           │
├──────────────────────────────────────────────┤
│            Embedding Layer                   │
│          (dim: 16 dimensions)                │
├──────────────────────────────────────────────┤
│       GlobalAveragePooling1D                 │
├──────────────────────────────────────────────┤
│            Dense Layer                       │
│         (24 units, ReLU)                     │
├──────────────────────────────────────────────┤
│           Output Layer                       │
│        (1 unit, Sigmoid)                     │
│       Output: 0.0 - 1.0                      │
└──────────────────────────────────────────────┘
```

## Hyperparameters

| Parameter | Value |
|-----------|-------|
| Training Size | 20,000 samples |
| Vocabulary Size | 10,000 tokens |
| Max Sequence Length | 100 tokens |
| Embedding Dimension | 16 |
| Epochs | 30 |
| Optimizer | Adam |
| Loss Function | Binary Crossentropy |

## Files

| File | Description |
|------|-------------|
| `lexical_sarcasm_detection__create.py` | Training script - downloads dataset and trains model |
| `lexical_sarcasm_detection__run.py` | Inference script - loads model and makes predictions |
| `sarcasm_model.keras` | Saved trained model weights |
| `vocabulary.json` | Tokenizer vocabulary |
| `vectorizer_config.json` | TextVectorization layer config |
| `vecs.tsv` / `meta.tsv` | Embedding projector files for visualization |

## Usage

### Training a New Model

```bash
python lexical_sarcasm_detection__create.py
```

This will:
1. Download the sarcasm dataset from Google Cloud Storage
2. Split into training (20,000) and testing sets
3. Train for 30 epochs with validation
4. Save the model to `sarcasm_model.keras`

### Running Inference

```python
import tensorflow as tf

model = tf.keras.models.load_model('sarcasm_model.keras')
text = tf.constant(["Oh wow, another meeting. How exciting."])
prediction = model.predict(text)
print(f"Sarcasm score: {prediction[0][0]:.2%}")
```

### Example Predictions

```python
# Sarcastic examples (high scores)
"granny starting to fear spiders in the garden might be real" → 0.7234

# Non-sarcastic examples (low scores)
"the dog has really soft fur and is very friendly" → 0.1523
```

## Development Environment Setup

### Prerequisites

- Python 3.9 - 3.12 (TensorFlow requirement)
- pyenv (recommended for version management)

### Setup with pyenv

```bash
# Install Python 3.12
pyenv install 3.12.11

# Set as global version
pyenv global 3.12.11

# Create virtual environment
pyenv virtualenv 3.12.11 ml_env

# Activate environment
pyenv activate ml_env

# Install dependencies
pip install -r requirements.txt
```

### Alternative: Using venv

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### VS Code Setup

After creating your environment, use `Cmd+Shift+P` → "Python: Select Interpreter" to select your virtual environment.

## Dependencies

Key packages (see `requirements.txt` for full list):

- `tensorflow>=2.16.0` — Deep learning framework
- `keras>=3.10.0` — High-level neural network API
- `numpy>=1.26.0` — Numerical computing
- `matplotlib>=3.10.0` — Visualization (for training plots)

## Training Data

The model is trained on the [Sarcasm Headlines Dataset](https://storage.googleapis.com/learning-datasets/sarcasm.json):

- **Source**: News headlines from The Onion (sarcastic) and HuffPost (non-sarcastic)
- **Format**: JSON with `headline`, `is_sarcastic`, and `article_link` fields
- **Size**: ~26,000 headlines total
- **Split**: 20,000 training / ~6,000 testing

## Resources

- [YouTube Tutorial](https://www.youtube.com/watch?v=-8XmD2zsFBI) — NLP Course walkthrough
- [Colab Notebook](https://colab.research.google.com/github/lmoroney/dlaicourse/blob/master/TensorFlow%20In%20Practice/Course%203%20-%20NLP/Course%203%20-%20Week%201%20-%20Lesson%203.ipynb) — Interactive tutorial
- [TensorFlow Text Guide](https://www.tensorflow.org/text/guide) — Official documentation

## Future Improvements

- [ ] Integrate model into Flask backend
- [ ] Add prosodic (audio) sarcasm detection model
- [ ] Experiment with transformer-based architectures (BERT, etc.)
- [ ] Add confidence calibration
- [ ] Improve handling of context-dependent sarcasm

## Notes

### pyenv Quick Reference

```bash
# List installed Python versions
pyenv versions

# List available Python versions
pyenv install -l

# Install specific version
pyenv install 3.12.11

# Create virtualenv
pyenv virtualenv 3.12.11 ml_env

# Activate virtualenv
pyenv activate ml_env

# Deactivate
pyenv deactivate

# Save current packages
pip freeze > requirements.txt
```

### TensorFlow Compatibility

TensorFlow 2.16+ requires Python 3.9-3.12. If you encounter issues:

1. Verify Python version: `python --version`
2. Ensure you're in the correct virtual environment
3. Check TensorFlow installation: `python -c "import tensorflow as tf; print(tf.__version__)"`
