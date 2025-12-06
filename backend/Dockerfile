FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and model
COPY app.py .
COPY sarcasm_model.pkl .

# Default port (Railway sets PORT env var dynamically)
ENV PORT=5000
EXPOSE $PORT

# Run with gunicorn for production
# Uses shell form to expand $PORT environment variable
CMD gunicorn --bind 0.0.0.0:$PORT --workers 2 app:app

