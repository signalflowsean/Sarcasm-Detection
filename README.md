# [Sarcasm Detector™](https://sarcasm-detector.com)

> _A signalflowsean production_

A full-stack web application that detects sarcasm in text and audio using machine learning. Features a beautiful retro VU meter-style interface with animated needle displays.

![Sarcasm Detector](https://img.shields.io/badge/status-in%20development-yellow)
![License](https://img.shields.io/badge/license-MIT-blue)

## Overview

The Sarcasm Detector analyzes input through two detection modes:

- **Lexical Detection** — Analyzes _what_ you say (text-based)
- **Prosodic Detection** — Analyzes _how_ you say it (audio-based)

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

### Install (One-Time Setup)

```bash
# Install all dependencies (backend, frontend, and e2e)
npm run install:all
```

Or install individually:

```bash
npm run install:backend  # Python venv + dependencies
npm run install:frontend # Frontend npm packages
npm run install:e2e      # E2E test dependencies
```

> **Note:** Git hooks are automatically configured during installation via the `prepare` script. This sets up Husky to run `lint-staged` on pre-commit, which will automatically lint and format your staged files before committing. No manual setup required!

### Development (Recommended)

Start both servers with hot reload:

```bash
# Backend (Terminal 1)
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python app.py

# Frontend (Terminal 2)
cd frontend
npm run dev

# Or use the root helper script (no venv activation needed)
npm run dev
```

### E2E Tests

```bash
# Make sure dev servers are running, then:
npm run e2e
```

### Docker (Production Build)

Only needed for testing production builds:

```bash
docker compose up --build
```

## Project Structure

```
Sarcasm-Detection/
├── backend/                    # Flask API server
│   ├── app.py                 # Main application & API endpoints
│   ├── audio/                 # Audio processing module
│   ├── models/                # ML model loading & inference
│   ├── routes/                # API route blueprints
│   ├── tests/                 # Backend unit tests (pytest)
│   ├── sarcasm_model.pkl      # Trained lexical model
│   ├── prosodic_model.pkl     # Trained prosodic model
│   ├── requirements.txt       # Python dependencies
│   ├── requirements-dev.txt   # Dev/test dependencies
│   └── Dockerfile             # Backend container configuration
│
├── frontend/                   # React + TypeScript + Vite application
│   ├── src/
│   │   ├── features/
│   │   │   ├── input/         # Text & audio input components
│   │   │   └── meter/         # VU meter display components
│   │   ├── test/              # Test setup & mocks
│   │   ├── App.tsx            # Main application component
│   │   └── main.tsx           # Application entry point
│   ├── vitest.config.ts       # Vitest test configuration
│   ├── Dockerfile             # Frontend container configuration
│   └── nginx.conf             # Production server configuration
│
├── e2e/                        # End-to-end tests (Playwright)
│   ├── tests/                 # E2E test specs
│   └── playwright.config.ts   # Playwright configuration
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

| Layer          | Technology                                  |
| -------------- | ------------------------------------------- |
| Frontend       | React 19, TypeScript, Vite, React Router    |
| Backend        | Flask, Flask-CORS, Flask-Limiter, Gunicorn  |
| ML (Lexical)   | scikit-learn (TF-IDF + Logistic Regression) |
| ML (Prosodic)  | Wav2Vec2 (ONNX Runtime) + scikit-learn      |
| Testing        | Vitest, Playwright, pytest                  |
| Infrastructure | Docker, Docker Compose, Nginx               |

## Development

### Environment Variables

**Backend:**

| Variable              | Default         | Description                                                                   |
| --------------------- | --------------- | ----------------------------------------------------------------------------- |
| `API_DELAY_SECONDS`   | `2.0`           | Artificial delay for showcasing loading animations (set to `0` in production) |
| `FLASK_ENV`           | `production`    | Flask environment mode                                                        |
| `RATE_LIMIT_ENABLED`  | `true`          | Enable/disable rate limiting                                                  |
| `RATE_LIMIT_DEFAULT`  | `60 per minute` | Default rate limit for all endpoints                                          |
| `RATE_LIMIT_LEXICAL`  | `30 per minute` | Rate limit for text analysis endpoint                                         |
| `RATE_LIMIT_PROSODIC` | `10 per minute` | Rate limit for audio analysis endpoint                                        |
| `RATE_LIMIT_STORAGE`  | `memory://`     | Storage backend (`memory://` or `redis://host:port`)                          |

**Frontend:**

| Variable               | Default                 | Description                                             |
| ---------------------- | ----------------------- | ------------------------------------------------------- |
| `VITE_API_URL`         | `http://localhost:5000` | Backend API URL                                         |
| `VITE_MOONSHINE_MODEL` | `model/base`            | Speech recognition model (`model/tiny` or `model/base`) |

#### Moonshine Speech Recognition Configuration

The app uses [Moonshine](https://www.moonshine.ai/) for on-device speech-to-text. Models are downloaded once and cached by the browser.

**Why Moonshine?** The Web Speech API isn't fully implemented across mobile browsers (especially iOS Safari). Moonshine provides consistent speech-to-text behavior across all platforms with predictable accuracy.

**Available Models:**

| Model        | Size   | Accuracy (WER) | Use Case                    |
| ------------ | ------ | -------------- | --------------------------- |
| `model/tiny` | ~190MB | 15-20%         | Fast, mobile-friendly       |
| `model/base` | ~400MB | 10-12%         | **Default** - Best accuracy |

**Default:** `model/base` for better speech-to-text accuracy, which improves the lexical detection component. The app combines both lexical (text-based) and prosodic (audio-based) detection for overall sarcasm scoring.

**Switching Models:**

1. **Development:** Edit `frontend/.env.local` and set `VITE_MOONSHINE_MODEL=model/{name}`
2. **Production:** Update environment variable in Railway dashboard (requires rebuild)
3. **Dev Mode Testing:** Use the model selector (bottom-left corner in dev mode)

**Important:**

- Changing models requires a rebuild and redeploy
- Users only re-download when you **change which model** is used (e.g., tiny → base)
- Regular app deployments (same model) do NOT require re-download - models stay cached
- Models are served from Moonshine CDN, independent of your app deployment

See [`frontend/docs/MOONSHINE_MODELS.md`](frontend/docs/MOONSHINE_MODELS.md) for detailed model comparison, performance metrics, and selection guidance.

### Running Tests

**Backend (pytest):**

```bash
cd backend
pip install -r requirements-dev.txt
pytest                    # Run all tests
pytest -v                 # Verbose output
pytest --cov=.            # With coverage report
pytest tests/test_lexical.py  # Run specific test file
```

**Frontend (Vitest):**

```bash
cd frontend
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
```

**End-to-End (Playwright):**

```bash
cd e2e
npm install
npx playwright install    # Install browsers (first time)
npm test                  # Run all E2E tests
npm run test:ui           # Interactive UI mode
npm run test:debug        # Debug mode
npm run test:report       # View test report
```

**Linting:**

```bash
# Frontend
cd frontend
npm run lint              # ESLint
npm run lint:fix          # Auto-fix issues
npm run format            # Prettier
npm run format:check      # Check formatting

# Backend
cd backend
pip install -r requirements-dev.txt
ruff check .              # Lint
ruff check . --fix        # Auto-fix
ruff format .             # Format
```

### Git Hooks (Pre-commit)

The project uses [Husky](https://typicode.github.io/husky/) to automatically run linting and formatting on staged files before each commit. This is configured automatically when you run `npm install` (via the `prepare` script).

**What happens on commit:**
- Staged `.ts` and `.tsx` files are automatically linted with ESLint (auto-fix) and formatted with Prettier
- Staged `.css` and `.json` files are automatically formatted with Prettier
- If linting/formatting fails, the commit is blocked until issues are resolved

**No manual setup required** — Git hooks are configured automatically during installation. If you need to manually reinstall hooks (e.g., after cloning), run:

```bash
npm install  # From project root (runs prepare script automatically)
# or
cd frontend && npm install  # From frontend directory
```

### Mobile Testing

Since prosodic detection is the core use case, testing on actual mobile devices is critical. Mobile browsers require **HTTPS for microphone access**, so use one of these methods:

#### Option A: LocalTunnel (Easiest)

```bash
# Terminal 1: Start dev server
cd frontend
npm run dev

# Terminal 2: Create HTTPS tunnel
npx localtunnel --port 5173
# Output: https://random-name.loca.lt

# Open the URL on your phone to test!
```

**Pros:** No configuration, instant HTTPS
**Cons:** Random URL changes each restart

#### Option B: ngrok (More Reliable)

```bash
# One-time install
brew install ngrok  # or: npm install -g ngrok

# Terminal 1: Start dev server
cd frontend
npm run dev

# Terminal 2: Create tunnel
ngrok http 5173
# Output: https://abc123.ngrok-free.app
```

**Pros:** Stable URLs (with account), better performance
**Cons:** Requires account for persistent URLs

#### Option C: Local Network (No Microphone)

```bash
# Start with network access
cd frontend
npm run dev -- --host

# Find your IP: ifconfig | grep "inet " (macOS/Linux)
# Access from phone: http://YOUR_IP:5173
```

⚠️ **Warning:** Microphone won't work on iOS/Safari without HTTPS

#### Mobile Testing Workflow

1. Start dev server with tunnel (Option A or B recommended)
2. Open tunnel URL on your phone
3. Use the model selector (visible in dev mode) to test different models
4. Record speech and test prosodic detection
5. Open browser console and run `window.viewMoonshineMetrics()` to see performance data
6. Compare load times and accuracy across models on real mobile connection

See [`frontend/docs/MOONSHINE_MODELS.md`](frontend/docs/MOONSHINE_MODELS.md) for model comparison and testing guidance.

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

| Argument             | Default                       | Description                                      |
| -------------------- | ----------------------------- | ------------------------------------------------ |
| `WAV2VEC_CACHE_BUST` | `1`                           | Increment to force re-download of Wav2Vec2 model |
| `WAV2VEC_MODEL`      | `facebook/wav2vec2-base-960h` | Hugging Face model to use for audio embeddings   |

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
| `VITE_MOONSHINE_MODEL` | Speech model: `model/tiny` or `model/base` (default: `model/base`) |

**Backend:**
| Variable | Description |
|----------|-------------|
| `API_DELAY_SECONDS` | Set to `0` for production |
| `FLASK_ENV` | Set to `production` |

#### Changing Moonshine Model in Production

**Important Distinction:**

- **Same model + app update**: Users keep cached model ✅ (instant load)
- **Different model**: Users must re-download ❌ (400MB for base)

Models are served from Moonshine CDN (`download.moonshine.ai`), not from your app. Regular deploys don't affect model caching.

**Process to Change Models:**

1. Navigate to Railway dashboard → Frontend service → Variables
2. Update `VITE_MOONSHINE_MODEL=model/{name}` (e.g., `model/base`)
3. Redeploy: `railway up -s Frontend` or push to main branch
4. Monitor first-user experience for load times (only affects users switching models)
5. Consider announcing model change if it significantly affects UX

**Example Timeline:**

- Day 1: Deploy with `model/base` → Users download 400MB
- Day 5: Deploy bug fix (same `model/base`) → Users load instantly from cache ✅
- Day 10: Switch to `model/tiny` → Users download 190MB (new model)

**Model Selection Guidance:**

- **`model/base`** (400MB): Default - Best transcription accuracy for lexical detection
- **`model/tiny`** (190MB): Fastest, use if users report long load times

Note: Prosodic detection (audio analysis) is unaffected by transcription quality. Better models improve the lexical (text) component of sarcasm detection.

See [`frontend/docs/MOONSHINE_MODELS.md`](frontend/docs/MOONSHINE_MODELS.md) for detailed model comparison.

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

### 🎙️ Moonshine Model Optimization (Phase 2)

Phase 1 (completed): Switched to base model for better accuracy, added dev-only selector and telemetry.

Future Phase 2 options (data-driven decision):

- [ ] **Dynamic Model Selection**: Auto-detect network speed and load optimal model (tiny/base)
- [ ] **Progressive Loading**: Load tiny model first, upgrade to base in background for instant UX
- [ ] **Model Streaming**: Download models in chunks to improve perceived load time
- [ ] **Analytics Integration**: Track real user metrics to optimize model selection strategy

See [`frontend/docs/MOONSHINE_MODELS.md`](frontend/docs/MOONSHINE_MODELS.md) for detailed model comparison and trade-offs.

### 📝 Other Improvements

- [ ] Add OpenAPI/Swagger documentation for API
- [ ] Performance monitoring/logging
- [ ] Model versioning and A/B testing support

---

## Known Issues

### MoonshineJS VAD Dependency Warning

The `@moonshine-ai/moonshine-js` package (v0.1.29) has a broken file path dependency on `@ricky0123/vad-web` that references a path only valid in their monorepo. Running `npm ls` will show an "invalid" warning.

**Impact:** None for this project. We disable VAD by passing `false` to the `MicrophoneTranscriber` constructor, so the vad-web code path is never executed. Both `npm install` and `npm run build` succeed.

**Status:** Known issue in the upstream package. Does not affect functionality.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

_Built with ❤️ by signalflowsean_
