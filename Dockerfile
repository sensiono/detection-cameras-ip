# ==========================================
# Multi-stage Dockerfile for Render Deployment
# Stage 1: Build Angular Frontend
# ==========================================
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build -- --configuration production

# ==========================================
# Stage 2: Final Runtime with Python + Nginx
# ==========================================
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    USE_SQLITE=1 \
    DJANGO_DEBUG=0

# Install Nginx, curl, and basic build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    curl \
    gcc \
    default-libmysqlclient-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy Backend Code
COPY backend/ /app/backend/

# Copy Built Frontend from Stage 1 into Nginx HTML directory
COPY --from=frontend-build /app/frontend/dist/frontend/browser /usr/share/nginx/html

# Setup Nginx configuration
COPY nginx.render.conf /etc/nginx/conf.d/default.conf

# Setup Entrypoint Script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Expose Render's standard web port
EXPOSE 10000

CMD ["/app/entrypoint.sh"]
