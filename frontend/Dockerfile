# ==========================================
# Frontend Production Multi-Stage Dockerfile
# ==========================================

# --- Stage 1: Builder ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies using clean install
COPY package*.json ./
RUN npm ci

# Copy source assets and build production bundle
COPY . .
RUN npm run build

# --- Stage 2: Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy package metadata, config, and built bundles
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/vite.config.ts ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

# Start production preview server (serves TanStack Start application on port 3000)
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3000"]
