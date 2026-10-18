# EcoSentinel — Google Cloud Platform Production Deployment Guide

## 1. Cloud Architecture

EcoSentinel is designed for seamless containerized deployment on **Google Cloud Platform (GCP)**:

- **Frontend & Backend API:** Google Cloud Run (Serverless container runtime)
- **Model Engine:** Google Gemini 3.8 Flash via Vertex AI / Google GenAI SDK
- **Earth Observation Engine:** Google Earth Engine API
- **Managed Relational Storage:** Google Cloud SQL (PostgreSQL)
- **Unstructured / Report Artifacts:** Google Cloud Storage (GCS)
- **Secrets Management:** Google Cloud Secret Manager

---

## 2. Dockerfile Deployment Specification

### 2.1 Backend Dockerfile (`backend/Dockerfile`)
```dockerfile
FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### 2.2 Cloud Run Deployment Command
```bash
gcloud run deploy ecosentinel-backend \
    --source ./backend \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars APP_ENV=production,DATABASE_URL=postgresql://user:pass@/cloudsql/project:region:instance/db \
    --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```
