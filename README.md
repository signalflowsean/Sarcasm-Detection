# [Sarcasm Detector™](https://sarcasm-detector.com)

> *A signalflowsean production*

A full-stack web application that detects sarcasm in text and audio using machine learning. Features a beautiful retro VU meter-style interface with animated needle displays.

![Sarcasm Detector](https://img.shields.io/badge/status-in%20development-yellow)
![License](https://img.shields.io/badge/license-MIT-blue)

## Overview

The Sarcasm Detector analyzes input through two detection modes:

- **Lexical Detection** — Analyzes *what* you say (text-based)
- **Prosodic Detection** — Analyzes *how* you say it (audio-based)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                       │
│                   Port 80 (Production)                      │
│                   Port 5173 (Development)                   │
├─────────────────────────────────────────────────────────────┤
│                       │                                     │
│    ┌──────────────────▼──────────────────┐                 │
│    │         Flask Backend               │                 │
│    │           Port 5000                 │                 │
│    │  ┌────────────┬────────────────┐   │                 │
│    │  │  /api/     │  /api/prosodic │   │                 │
│    │  │  lexical   │                │   │                 │
│    │  └──────┬─────┴───────┬────────┘   │                 │
│    │         │             │            │                 │
│    │    ┌────▼────┐   ┌────▼────┐      │                 │
│    │    │ TF-IDF  │   │Wav2Vec2 │      │                 │
│    │    │+ LogReg │   │+ LogReg │      │                 │
│    │    └─────────┘   └─────────┘      │                 │
│    └────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Build and start all services
docker-compose up --build

# Access the application
open http://localhost
```

### Manual Development Setup

#### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
Sarcasm-Detection/
├── backend/                    # Flask API server
│   ├── app.py                 # Main application & API endpoints
│   ├── sarcasm_model.pkl      # Trained lexical model
│   ├── prosodic_model.pkl     # Trained prosodic model
│   ├── Dockerfile             # Backend container configuration
│   └── requirements.txt       # Python dependencies
│
├── frontend/                   # React + TypeScript + Vite application
│   ├── src/
│   │   ├── features/
│   │   │   ├── input/         # Text & audio input components
│   │   │   └── meter/         # VU meter display components
│   │   ├── App.tsx            # Main application component
│   │   └── main.tsx           # Application entry point
│   ├── Dockerfile             # Frontend container configuration
│   └── nginx.conf             # Production server configuration
│
├── ml/                         # Machine learning training pipelines
│   ├── lexical/               # Text-based sarcasm detection
│   │   ├── train_sklearn_model.py  # TF-IDF + LogReg (production)
│   │   ├── inference.py       # Test utility
│   │   └── README.md          # Detailed documentation
│   ├── prosodic/              # Audio-based sarcasm detection
│   │   ├── mustard_prepare.py     # Dataset preparation
│   │   ├── mustard_embeddings.py  # Wav2Vec2 embedding extraction
│   │   ├── train_prosodic.py      # Model training
│   │   ├── inference.py           # Test utility
│   │   └── README.md              # Detailed documentation
│   └── README.md              # ML overview
│
├── docker-compose.yml         # Multi-container orchestration
└── README.md                  # This file
```

## Model Training

Pre-trained models are included in `backend/`. To retrain from scratch:

```bash
# Lexical model (quick, auto-downloads data)
cd ml/lexical
pip install -r requirements.txt
python train_sklearn_model.py

# Prosodic model (requires ~2GB video download)
cd ml/prosodic
pip install -r requirements.txt
brew install ffmpeg  # or: sudo apt install ffmpeg
python mustard_prepare.py      # Download & extract audio
python mustard_embeddings.py   # Extract Wav2Vec2 embeddings
python train_prosodic.py       # Train classifier
```

See [ml/README.md](ml/README.md) for detailed documentation.

## API Endpoints

### `POST /api/lexical`

Lexical (text-based) sarcasm detection.

**Request:**
```json
{
  "text": "Oh great, another meeting that could have been an email"
}
```

**Response:**
```json
{
  "id": "uuid-string",
  "value": 0.85,
  "reliable": true
}
```

### `POST /api/prosodic`

Prosodic (audio-based) sarcasm detection.

**Request:** `multipart/form-data` with `audio` file

**Response:**
```json
{
  "id": "uuid-string",
  "value": 0.72,
  "reliable": true
}
```

> **Note:** The `reliable` field indicates whether the prediction came from the actual ML model (`true`) or is a fallback value due to model unavailability (`false`). When `reliable` is `false`, the UI displays a warning to users.

### `GET /api/health`

Health check endpoint for container orchestration.

**Response:**
```json
{
  "status": "healthy"
}
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, React Router |
| Backend | Flask, Flask-CORS, Flask-Limiter, Gunicorn |
| ML (Lexical) | scikit-learn (TF-IDF + Logistic Regression) |
| ML (Prosodic) | Wav2Vec2 (HuggingFace) + scikit-learn |
| Infrastructure | Docker, Docker Compose, Nginx |

## Development

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_DELAY_SECONDS` | `2.0` | Artificial delay for showcasing loading animations (set to `0` in production) |
| `FLASK_ENV` | `production` | Flask environment mode |
| `RATE_LIMIT_ENABLED` | `true` | Enable/disable rate limiting |
| `RATE_LIMIT_DEFAULT` | `60 per minute` | Default rate limit for all endpoints |
| `RATE_LIMIT_LEXICAL` | `30 per minute` | Rate limit for text analysis endpoint |
| `RATE_LIMIT_PROSODIC` | `10 per minute` | Rate limit for audio analysis endpoint |
| `RATE_LIMIT_STORAGE` | `memory://` | Storage backend (`memory://` or `redis://host:port`) |

### Running Tests

```bash
# Frontend
cd frontend
npm run lint

# Backend
cd backend
# Tests coming soon
```

## Features

- 🎨 Retro VU meter-style interface with animated needle
- 📝 Text input with real-time analysis
- 🎤 Audio recording with waveform visualization
- 🔄 Smooth loading state animations
- 📱 Responsive design for mobile devices
- 🐳 Docker containerization for easy deployment

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Local Docker Deployment

You can run the full application locally using Docker Compose. This mirrors the production environment but **does not support hot reload** — use the [manual development setup](#manual-development-setup) if you need hot reload during development.

```bash
# Build and start all services
docker-compose up --build

# Access the application
open http://localhost

# Stop the services
docker-compose down
```

To rebuild after making changes:

```bash
# Rebuild and restart
docker-compose up --build

# Or rebuild a specific service
docker-compose up --build frontend
docker-compose up --build backend
```

### Build Arguments

The backend Dockerfile supports build arguments for cache management:

| Argument | Default | Description |
|----------|---------|-------------|
| `WAV2VEC_CACHE_BUST` | `1` | Increment to force re-download of Wav2Vec2 model |
| `WAV2VEC_MODEL` | `facebook/wav2vec2-base-960h` | Hugging Face model to use for audio embeddings |

```bash
# Force re-download of Wav2Vec2 model (e.g., after model update)
docker-compose build --build-arg WAV2VEC_CACHE_BUST=2 backend

# Use a different Wav2Vec2 model
docker-compose build --build-arg WAV2VEC_MODEL=facebook/wav2vec2-large backend
```

## Deployment (Railway)

The application is deployed on [Railway](https://railway.app) with frontend and backend as separate services in one project.

### Prerequisites

- [Railway CLI](https://docs.railway.app/develop/cli) installed
- Railway account with access to the project

### Initial Setup

```bash
# Install Railway CLI (if not installed)
npm install -g @railway/cli

# Login to Railway
railway login
```

### Deploying

**Option A: From project root (using -s flag)**

```bash
cd Sarcasm-Detection
railway link  # Select: sarcasm → production → skip service
railway up -s Frontend
railway up -s Backend
```

**Option B: From within each folder**

```bash
# Deploy frontend
cd frontend
railway link  # Select: sarcasm → production → Frontend
railway up

# Deploy backend
cd ../backend
railway link  # Select: sarcasm → production → Backend
railway up
```

> **Note:** Root directories are configured in the Railway dashboard, not in `railway.toml`. Service names are case-sensitive.

### Environment Variables

Configure these in the Railway dashboard for each service:

**Frontend:**
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend URL (e.g., `https://backend-production-xxxx.up.railway.app`) |

**Backend:**
| Variable | Description |
|----------|-------------|
| `API_DELAY_SECONDS` | Set to `0` for production |
| `FLASK_ENV` | Set to `production` |

### Custom Domain

The frontend is configured with a custom domain (`sarcasm-detector.com`).

**DNS Setup (Namecheap):**
- Type: `ALIAS`
- Host: `@`
- Value: Railway's provided target (e.g., `xyz123.up.railway.app`)

**Railway Setup:**
- Custom domain port must be set to `8080` (Railway's internal port)
- Wait for TLS certificate to be issued (green checkmark)

> **Important:** When re-adding a custom domain, Railway may provide a new target. Always update your DNS to match.

---

## TODO / Future Improvements

### 🐳 Docker Image Optimization
**Current size:** ~2.75GB | **Target:** ~1.5-2GB

The backend image is large due to PyTorch (~700MB). Consider migrating to ONNX Runtime for inference:
- Export Wav2Vec2 model to ONNX format
- Replace `torch`/`torchaudio` with `onnxruntime` (~150MB)
- Update `audio/processing.py` to use ONNX inference

### 🎨 CSS Variables Cleanup
Extract hardcoded "magic numbers" into CSS custom properties for maintainability:

**Spacing** (padding, margin, gap):
- `0.375rem` (6px) — micro | `0.56rem` (9px) — small | `0.75rem` (12px) — base
- `0.94rem` (15px) — medium | `1.125rem` (18px) — large | `1.5rem` (24px) — xl | `1.875rem` (30px) — 2xl

**Border Radii:**
- `0.19rem` — tiny (kbd) | `0.28rem` — small (already `--border-radius-primary`)
- `0.45rem` — medium (buttons) | `0.56rem` — large (cards, modals)

**Animation Durations:**
- `100ms` — micro | `140ms` — hover | `160ms` — quick | `180ms` — standard | `350ms` — views | `500ms` — loading

**Font Sizes** (type scale):
- `0.49rem`, `0.56rem` — tiny | `0.675rem`, `0.71rem` — small | `0.75rem`, `0.83rem` — base
- `0.94rem`, `1.05rem` — medium | `1.125rem+` — large/headings

**Shadows:** Button, card/modal, inset depth, brass/metallic highlights

**Suggested naming:** `--space-{xs,sm,md,lg,xl}`, `--radius-{sm,md,lg}`, `--duration-{fast,normal,slow}`, `--shadow-{sm,md,lg}`

### 🧪 Testing & CI/CD
- [ ] Add unit tests for backend (pytest)
- [ ] Add unit tests for frontend (Vitest)
- [ ] Add integration tests for API endpoints
- [ ] Set up ESLint + Prettier for frontend
- [ ] Set up Ruff/Black for backend linting
- [ ] Create GitHub Actions workflow for:
  - Linting on PR
  - Running tests on PR
  - Docker build verification
  - Automated deployment to Railway on merge to main

### 📝 Other Improvements
- [ ] Add OpenAPI/Swagger documentation for API
- [ ] Add end-to-end tests (Playwright)
- [ ] Performance monitoring/logging
- [ ] Model versioning and A/B testing support

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

*Built with ❤️ by signalflowsean*

