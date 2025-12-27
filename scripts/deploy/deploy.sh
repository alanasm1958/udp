#!/bin/bash
set -e

cd "$(dirname "$0")/../.."

echo "=== UDP Production Deploy ==="
echo ""

if [ ! -f .env.prod ]; then
  echo "ERROR: .env.prod not found. Copy .env.prod.example to .env.prod and configure it."
  exit 1
fi

set -a
source .env.prod
set +a

echo "1. Pulling latest code..."
git pull origin main

echo ""
echo "2. Building Docker images..."
docker compose -f docker-compose.prod.yml build

echo ""
echo "3. Running database migrations..."
docker compose -f docker-compose.prod.yml run --rm app npm run db:migrate

echo ""
echo "4. Restarting services..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "5. Waiting for health checks..."
sleep 10

if curl -s http://localhost:3000/api/auth/bootstrap > /dev/null; then
  echo ""
  echo "=== Deploy Complete ==="
  echo "App is running at https://$DOMAIN"
else
  echo ""
  echo "WARNING: Health check failed. Check logs with:"
  echo "  docker compose -f docker-compose.prod.yml logs app"
fi
