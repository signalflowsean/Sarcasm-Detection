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
│    │  └────────────┴────────────────┘   │                 │
│    └──────────────────┬──────────────────┘                 │
│                       │                                     │
│    ┌──────────────────▼──────────────────┐                 │
│    │      ML Model (TensorFlow/Keras)    │                 │
│    │         sarcasm_model.keras         │                 │
│    └─────────────────────────────────────┘                 │
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
├── backend/              # Flask API server
│   ├── app.py           # Main application & API endpoints
│   ├── Dockerfile       # Backend container configuration
│   └── requirements.txt # Python dependencies
│
├── frontend/            # React + TypeScript + Vite application
│   ├── src/
│   │   ├── features/
│   │   │   ├── input/   # Text & audio input components
│   │   │   └── meter/   # VU meter display components
│   │   ├── App.tsx      # Main application component
│   │   └── main.tsx     # Application entry point
│   ├── Dockerfile       # Frontend container configuration
│   └── nginx.conf       # Production server configuration
│
├── ml/                  # Machine learning model & training
│   ├── lexical_sarcasm_detection__create.py  # Model training script
│   ├── lexical_sarcasm_detection__run.py     # Model inference script
│   ├── sarcasm_model.keras                   # Trained model weights
│   └── requirements.txt                      # ML dependencies
│
├── docker-compose.yml   # Multi-container orchestration
└── README.md           # This file
```

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
  "value": 0.85
}
```

### `POST /api/prosodic`

Prosodic (audio-based) sarcasm detection.

**Request:** `multipart/form-data` with `audio` file

**Response:**
```json
{
  "id": "uuid-string",
  "value": 0.72
}
```

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
| Backend | Flask, Flask-CORS, Gunicorn |
| ML | TensorFlow 2.16, Keras 3.10 |
| Infrastructure | Docker, Docker Compose, Nginx |

## Development

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_DELAY_SECONDS` | `2.0` | Artificial delay for showcasing loading animations (set to `0` in production) |
| `FLASK_ENV` | `production` | Flask environment mode |

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

## License

MIT License - see [LICENSE](LICENSE) for details.

---

*Built with ❤️ by signalflowsean*

