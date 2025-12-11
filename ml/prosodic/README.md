# Prosodic Sarcasm Detection

Audio-based sarcasm detection using Wav2Vec2 embeddings and classical machine learning.

## Overview

This module trains a prosodic sarcasm detector on the MUStARD dataset using:

- **Feature Extraction**: facebook/wav2vec2-base-960h pretrained speech encoder
- **Classifier**: Logistic Regression on mean-pooled embeddings
- **Dataset**: MUStARD (690 samples: 345 sarcastic / 345 non-sarcastic)

## Quick Start

### 1. Install Dependencies

```bash
cd ml/prosodic
pip install -r requirements.txt
```

Also ensure ffmpeg is installed:

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg
```

### 2. Prepare Dataset

Download MUStARD annotations and videos, extract audio:

```bash
python mustard_prepare.py
```

This will:

- Download annotations from MUStARD GitHub repo
- Download videos from HuggingFace (several GB)
- Extract audio as 16kHz mono WAV files
- Create `data/processed/mustard_index.csv`

### 3. Extract Embeddings

Extract Wav2Vec2 embeddings from audio files:

```bash
python mustard_embeddings.py
```

This will:

- Load each audio file
- Extract 768-dimensional embeddings via Wav2Vec2
- Save embeddings to `data/processed/embeddings/`
- Create `data/processed/mustard_index_with_embeddings.csv`

### 4. Train Model

Train the classifier:

```bash
python train_prosodic.py
```

This will:

- Evaluate with 5-fold cross-validation (MUStARD standard)
- Train final model on all data
- Save to `backend/prosodic_model.pkl`

### 5. Test Inference

Test on audio files:

```bash
python inference.py path/to/audio.wav
python inference.py audio1.wav audio2.mp3 --verbose
```

## Directory Structure

```
ml/prosodic/
├── data/
│   ├── raw/
│   │   ├── MUStARD/           # Annotations (sarcasm_data.json)
│   │   └── videos/            # Downloaded videos
│   └── processed/
│       ├── audio_wav/         # Extracted 16kHz mono WAV
│       ├── embeddings/        # Wav2Vec2 embeddings (.npy)
│       ├── mustard_index.csv  # Dataset index
│       └── mustard_index_with_embeddings.csv
├── mustard_prepare.py         # Data preparation
├── mustard_embeddings.py      # Embedding extraction
├── train_prosodic.py          # Model training
├── inference.py               # Testing utility
├── requirements.txt           # Python dependencies
└── README.md                  # This file
```

## Model Architecture

```
Audio (any format)
       │
       ▼
┌─────────────────────────────┐
│  Preprocessing              │
│  - Decode to waveform       │
│  - Convert to mono          │
│  - Resample to 16kHz        │
│  - Normalize (zero mean)    │
└─────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Wav2Vec2-base-960h         │
│  (frozen, pretrained)       │
│  Output: (frames, 768)      │
└─────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Mean Pooling               │
│  Output: (768,)             │
└─────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  StandardScaler             │
└─────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Logistic Regression        │
│  Output: P(sarcastic)       │
└─────────────────────────────┘
       │
       ▼
   Score: [0.0, 1.0]
```

## Expected Performance

Based on MUStARD paper and similar work:

| Approach                      | Weighted F1 |
| ----------------------------- | ----------- |
| MFCC + SVM (MUStARD baseline) | ~60-65%     |
| Wav2Vec2 + LogReg (this)      | ~65-72%     |
| Fine-tuned Wav2Vec2           | ~70-75%     |

Note: Audio-only performance is inherently limited compared to multimodal approaches.

## ONNX Export (for Deployment)

The backend uses ONNX Runtime instead of PyTorch for lighter Docker images (~2GB vs ~3.4GB). To regenerate the ONNX model:

```bash
cd ml/prosodic
pip install torch transformers onnx onnxruntime
python export_onnx.py
python verify_onnx.py  # optional verification
```

The exported `wav2vec2.onnx` file (~360MB) should be uploaded to GitHub releases for the Docker build to download.

## API Integration

The trained model is loaded by the Flask backend (`backend/app.py`):

```python
# POST /api/prosodic
# Content-Type: multipart/form-data
# Body: audio=<audio file>

# Response:
{
    "id": "uuid",
    "value": 0.0-1.0  # sarcasm score
}
```

## References

- [MUStARD Paper](https://arxiv.org/abs/1906.01815) - Castro et al., ACL 2019
- [MUStARD GitHub](https://github.com/soujanyaporia/MUStARD)
- [Wav2Vec2 Paper](https://arxiv.org/abs/2006.11477) - Baevski et al., 2020
- [HuggingFace Dataset](https://huggingface.co/datasets/MichiganNLP/MUStARD)
