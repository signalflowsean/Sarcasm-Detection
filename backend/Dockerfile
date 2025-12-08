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

# Copy application code and model files
# .dockerignore excludes __pycache__, .env, .git, etc.
# Note: wav2vec2.onnx should be in this directory if you want prosodic detection
# Generate with: cd ml/prosodic && python3 export_onnx.py
# Without it, the prosodic endpoint will return mock data
COPY . .

# Default port (Railway sets PORT env var dynamically)
ENV PORT=5000
EXPOSE $PORT

# Run with gunicorn for production
# --preload: Load app before forking workers (shares model memory, loads once)
# --timeout 120: Allow 2 minutes for slow requests (audio processing)
# --workers 2: Two workers for handling concurrent requests
CMD gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 --preload app:app
