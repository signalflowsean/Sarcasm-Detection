# Stage 1: Builder - compile Python packages with build tools
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build dependencies for compiling wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies into venv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download ONNX model (with retries for transient GitHub 504 errors)
# Explicitly fail if all attempts are exhausted
RUN rm -f /opt/wav2vec2.onnx && \
    for i in 1 2 3 4 5; do \
    echo "Attempt $i: Downloading wav2vec2.onnx..." && \
    curl -fL --retry 3 --retry-delay 5 --connect-timeout 30 --max-time 600 \
    -o /opt/wav2vec2.onnx \
    https://github.com/signalflowsean/Sarcasm-Detection/releases/download/v1.0.0-models/wav2vec2.onnx && \
    echo "d610dfa7dec087846f4f5c74562de176a4eeb9a1bd7ed23a35cfe33b8036e038  /opt/wav2vec2.onnx" | sha256sum -c - && \
    break || \
    (rm -f /opt/wav2vec2.onnx && echo "Attempt $i failed, waiting 30s..." && sleep 30); \
    done && \
    test -f /opt/wav2vec2.onnx || (echo "ERROR: All download attempts failed" && exit 1)


# Stage 2: Runtime - minimal image with only runtime deps
FROM python:3.11-slim

WORKDIR /app

# Install only runtime dependencies (no build tools)
# - ffmpeg: audio format conversion (WebM/Opus -> WAV)
# - libsndfile1: required by soundfile Python package
# - libgomp1: required by onnxruntime for OpenMP support
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    libgomp1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Copy virtual environment from builder (excludes build tools)
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy ONNX model from builder
COPY --from=builder /opt/wav2vec2.onnx ./wav2vec2.onnx

# Copy application code (includes .pkl model files)
# .dockerignore excludes __pycache__, .env, .git, tests/, wav2vec2.onnx (downloaded above)
COPY . .

# Default port (Railway sets PORT env var dynamically)
ENV PORT=5000
EXPOSE $PORT

# Run with gunicorn for production
# --preload: Load app before forking workers (shares model memory, loads once)
# --timeout 120: Allow 2 minutes for slow requests (audio processing)
# --workers 2: Two workers for handling concurrent requests
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 --preload app:app"]
