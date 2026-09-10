# ==============================================================================
# OrganMatch — All-in-One Production Dockerfile
# Combines: PostgreSQL, FastAPI Backend, React/TanStack Frontend, and Nginx
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Frontend SPA / SSR
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# ------------------------------------------------------------------------------
# Stage 2: Unified Production Container
# ------------------------------------------------------------------------------
FROM python:3.12-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install system dependencies: PostgreSQL, Nginx, Supervisor, and C/C++ libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql \
    postgresql-contrib \
    nginx \
    supervisor \
    libpq-dev \
    libpq5 \
    build-essential \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy Node.js binary and npm from Node official image
COPY --from=node:22-bookworm-slim /usr/local/include /usr/local/include
COPY --from=node:22-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

WORKDIR /app

# 1. Install Backend Python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# 2. Copy Backend application source code
COPY backend/ ./backend/

# 3. Copy built Frontend bundles from builder
COPY --from=frontend-builder /app/frontend/package*.json ./frontend/
COPY --from=frontend-builder /app/frontend/vite.config.ts ./frontend/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY --from=frontend-builder /app/frontend/node_modules ./frontend/node_modules

# 4. Configure Nginx
RUN rm -rf /etc/nginx/conf.d/default.conf /etc/nginx/sites-enabled/* /var/www/html/*
COPY nginx/nginx-allinone.conf /etc/nginx/nginx.conf

# 5. Configure Supervisor and Entrypoint
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY entrypoint-allinone.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Persistent storage for local PostgreSQL data
VOLUME ["/var/lib/postgresql"]

EXPOSE 80

ENTRYPOINT ["/app/entrypoint.sh"]
