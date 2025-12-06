# Sarcasm Detection ML Models

Machine learning models for detecting sarcasm in text (lexical) and audio (prosodic).

## Overview

This directory contains training pipelines for two types of sarcasm detection:

| Type | Input | Model | Dataset |
|------|-------|-------|---------|
| **Lexical** | Text | TF-IDF + LogReg | News Headlines |
| **Prosodic** | Audio | Wav2Vec2 + LogReg | MUStARD |

## Directory Structure

```
ml/
├── lexical/                    # Text-based sarcasm detection
│   ├── data/                   # Text datasets
│   ├── train_sklearn_model.py  # Production model training
│   ├── inference.py            # Test utility
│   └── README.md               # Detailed documentation
│
├── prosodic/                   # Audio-based sarcasm detection
│   ├── data/                   # Audio/video data
│   ├── mustard_prepare.py      # Dataset preparation
│   ├── mustard_embeddings.py   # Wav2Vec2 embedding extraction
│   ├── train_prosodic.py       # Model training
│   ├── inference.py            # Test utility
│   └── README.md               # Detailed documentation
│
├── requirements.txt            # Shared dependencies
└── README.md                   # This file
```

## Quick Start

### Lexical Model (Text)

```bash
cd ml/lexical
pip install -r requirements.txt

# Train
python train_sklearn_model.py

# Test
python inference.py "Oh great, another meeting"
```

### Prosodic Model (Audio)

```bash
cd ml/prosodic
pip install -r requirements.txt

# 1. Prepare dataset (downloads videos)
python mustard_prepare.py

# 2. Extract embeddings
python mustard_embeddings.py

# 3. Train
python train_prosodic.py

# Test
python inference.py path/to/audio.wav
```

## Model Outputs

Both models save to `backend/`:
- `backend/sarcasm_model.pkl` - Lexical model
- `backend/prosodic_model.pkl` - Prosodic model

## API Endpoints

The Flask backend (`backend/app.py`) exposes both models:

```
POST /api/lexical    →  Text sarcasm score [0, 1]
POST /api/prosodic   →  Audio sarcasm score [0, 1]
```

## Development Setup

### Prerequisites

- Python 3.10+ (3.12 recommended)
- ffmpeg (for audio processing)
- pyenv (optional, for version management)

### Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Or install module-specific deps
pip install -r lexical/requirements.txt
pip install -r prosodic/requirements.txt
```

## Expected Performance

| Model | Metric | Score |
|-------|--------|-------|
| Lexical (TF-IDF + LogReg) | Accuracy | ~85% |
| Prosodic (Wav2Vec2 + LogReg) | Weighted F1 | ~68% |

Note: Prosodic detection is inherently harder due to limited training data and the subtlety of vocal sarcasm.

## See Also

- [lexical/README.md](lexical/README.md) - Detailed lexical model documentation
- [prosodic/README.md](prosodic/README.md) - Detailed prosodic model documentation
