FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml ./
COPY src/api ./src/api
COPY src/contracts ./src/contracts
COPY src/pipeline ./src/pipeline
COPY data ./data

RUN python -m pip install --no-cache-dir .

RUN mkdir -p /app/db /app/storage /app/persist/storage

WORKDIR /app/src/api

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port \"${PORT:-8000}\" --workers 1"]
