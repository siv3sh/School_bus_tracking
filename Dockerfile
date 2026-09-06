# Render looks for ./Dockerfile at the repo root (build context = .).
FROM python:3.12-slim

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY backend/seed.py .
COPY web ./web

ENV PYTHONPATH=/app
ENV HOST=0.0.0.0

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
