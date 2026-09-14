#!/bin/sh
set -e

echo "=== Starting SORETRAK Deployment Container ==="

# Run migrations
python /app/backend/manage.py migrate --noinput

# Seed initial data (admin, users, cameras, SORETRAK company settings)
python /app/backend/manage.py seed_soretrak || true

# Collect static files for Django admin and API docs if needed
python /app/backend/manage.py collectstatic --noinput || true

# Start Gunicorn in background on 127.0.0.1:8000
echo "Starting Django Gunicorn backend on port 8000..."
cd /app/backend
gunicorn config.wsgi:application \
    --bind 127.0.0.1:8000 \
    --workers 2 \
    --threads 4 \
    --timeout 120 &

# Start Nginx in foreground on PORT (defaults to 10000 or 80)
PORT=${PORT:-10000}
echo "Configuring Nginx to listen on port ${PORT}..."
sed -i "s/PORT_PLACEHOLDER/${PORT}/g" /etc/nginx/conf.d/default.conf

echo "Starting Nginx reverse proxy..."
exec nginx -g "daemon off;"
