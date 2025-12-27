#!/bin/bash
set -e

cd "$(dirname "$0")/../.."

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/udp_backup_$TIMESTAMP.sql.gz"

if [ -f .env.prod ]; then
  set -a
  source .env.prod
  set +a
fi

mkdir -p "$BACKUP_DIR"

echo "=== UDP Database Backup ==="
echo "Backup file: $BACKUP_FILE"
echo ""

docker compose -f docker-compose.prod.yml exec -T db pg_dump \
  -U "${POSTGRES_USER:-udp}" \
  "${POSTGRES_DB:-udp}" | gzip > "$BACKUP_FILE"

if [ -f "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "Backup created: $BACKUP_FILE ($SIZE)"
else
  echo "ERROR: Backup failed"
  exit 1
fi

echo ""
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "udp_backup_*.sql.gz" -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true

REMAINING=$(ls -1 "$BACKUP_DIR"/udp_backup_*.sql.gz 2>/dev/null | wc -l)
echo "Remaining backups: $REMAINING"

echo ""
echo "=== Backup Complete ==="
