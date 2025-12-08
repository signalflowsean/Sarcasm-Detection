FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for audio processing
# - ffmpeg: CLI tool for audio format conversion (used as subprocess fallback)
# Note: We only need the ffmpeg CLI, not the development libraries (libavcodec-dev, etc.)
# since we're using ONNX Runtime instead of PyTorch/torchaudio
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# ONNX Runtime (~150MB) replaces PyTorch (~700MB) for much smaller image size
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy ONNX model file
# This ~360MB model file must be generated using ml/prosodic/export_onnx.py
# The model should be downloaded or generated before building the Docker image
COPY wav2vec2.onnx .

# Copy application code and model files
# .dockerignore excludes __pycache__, .env, .git, etc.
COPY . .

# Default port (Railway sets PORT env var dynamically)
ENV PORT=5000
EXPOSE $PORT

# Run with gunicorn for production
# --preload: Load app before forking workers (shares model memory, loads once)
# --timeout 120: Allow 2 minutes for slow requests (audio processing)
# --workers 2: Two workers for handling concurrent requests
CMD gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 --preload app:app
