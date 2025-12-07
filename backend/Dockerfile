FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for audio processing (ffmpeg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .
COPY config.py .
COPY routes/ ./routes/
COPY models/ ./models/
COPY audio/ ./audio/

# Copy model files
COPY sarcasm_model.pkl .
COPY prosodic_model.pkl .

# Default port (Railway sets PORT env var dynamically)
ENV PORT=5000
EXPOSE $PORT

# Run with gunicorn for production
# --preload: Load app before forking workers (shares model memory, loads once)
# --timeout 120: Allow 2 minutes for slow requests (audio processing)
# --workers 2: Two workers for handling concurrent requests
CMD gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 --preload app:app

