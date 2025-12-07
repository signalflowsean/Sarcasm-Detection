FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for audio processing (ffmpeg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# ============================================================================
# Install PyTorch CPU-only (saves ~2GB vs full PyTorch with CUDA)
# ============================================================================
# Full PyTorch includes CUDA libraries we don't need for CPU inference.
# CPU-only torch: ~700MB vs ~2GB for full version
RUN pip install --no-cache-dir \
    torch==2.6.0+cpu \
    torchaudio==2.6.0 \
    --index-url https://download.pytorch.org/whl/cpu

# ============================================================================
# TODO: Migrate to ONNX Runtime for smaller image (~2.75GB → ~1.5-2GB)
# ============================================================================
# ONNX Runtime is ~150MB vs PyTorch ~700MB, saving ~500MB+
#
# Steps to implement:
#   1. Export Wav2Vec2 model to ONNX format
#   2. Replace torch/torchaudio with onnxruntime
#   3. Update audio/processing.py to use ONNX inference
#
# See README.md "TODO / Future Improvements" for details.
# ============================================================================

# Install remaining Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ============================================================================
# Pre-download Wav2Vec2 model (cached in Docker layer)
# ============================================================================
# This downloads the ~360MB model during build instead of at runtime.
# To invalidate cache and re-download: bump WAV2VEC_CACHE_BUST
# 
# Example: docker build --build-arg WAV2VEC_CACHE_BUST=2 .
# ============================================================================
ARG WAV2VEC_CACHE_BUST=1
ARG WAV2VEC_MODEL=facebook/wav2vec2-base-960h

# Download and cache the model, then clean up transformers cache metadata
RUN python -c "\
from transformers import Wav2Vec2Processor, Wav2Vec2Model; \
print('Downloading Wav2Vec2 model: ${WAV2VEC_MODEL}'); \
Wav2Vec2Processor.from_pretrained('${WAV2VEC_MODEL}'); \
Wav2Vec2Model.from_pretrained('${WAV2VEC_MODEL}'); \
print('Model cached successfully')" \
    && find /root/.cache/huggingface -name "*.json" -size +1M -delete 2>/dev/null || true

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

