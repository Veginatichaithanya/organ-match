FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder stage
COPY --from=builder /venv /venv
ENV PATH="/venv/bin:$PATH"

# Copy app code
COPY . .

# Run container as a non-privileged system user
RUN useradd -u 1001 -m appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

ENV APP_ENV=production
ENV PYTHONUNBUFFERED=1
ENV JWT_SECRET_KEY=generate_a_secure_random_hex_key_for_production
ENV JWT_ALGORITHM=HS256
ENV JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
