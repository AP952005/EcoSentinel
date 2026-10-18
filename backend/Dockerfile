# ==============================================================================
# EcoSentinel Production Backend Dockerfile (Google Cloud Run Ready)
# ==============================================================================
FROM python:3.11-slim AS base

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install essential system libraries for GDAL, PROJ, and health probes
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    libgdal-dev \
    gdal-bin \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application codebase
COPY . .

# Create application data directories
RUN mkdir -p /app/data/uploads /app/data/exports /app/data/audio_cache

# Create non-root user for Cloud Run security compliance
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

USER appuser

# Cloud Run defaults to port 8080
ENV PORT=8080
EXPOSE 8080

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Launch application reading $PORT dynamically
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
