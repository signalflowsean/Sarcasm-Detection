FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for audio processing
# - ffmpeg: CLI tool for audio format conversion (used as subprocess fallback)
# - curl: for downloading ONNX model from GitHub releases
# Note: We only need the ffmpeg CLI, not the development libraries (libavcodec-dev, etc.)
# since we're using ONNX Runtime instead of PyTorch/torchaudio
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# ONNX Runtime (~150MB) replaces PyTorch (~700MB) for much smaller image size
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and model files
# .dockerignore excludes __pycache__, .env, .git, etc.
COPY . .

# Download Wav2Vec2 ONNX model from GitHub releases (~360MB)
# This is cached in a Docker layer, so subsequent builds are fast
# To update: create a new release and update the URL
# -f: fail on HTTP errors, file size check ensures download completed (~360MB)
RUN curl -fL -o wav2vec2.onnx \
    https://github.com/signalflowsean/Sarcasm-Detection/releases/download/v1.0.0-models/wav2vec2.onnx \
    && [ -s wav2vec2.onnx ] \
    && test $(stat -c%s wav2vec2.onnx) -gt 100000000

# Default port (Railway sets PORT env var dynamically)
ENV PORT=5000
EXPOSE $PORT

# Run with gunicorn for production
# --preload: Load app before forking workers (shares model memory, loads once)
# --timeout 120: Allow 2 minutes for slow requests (audio processing)
# --workers 2: Two workers for handling concurrent requests
CMD gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 --preload app:app
