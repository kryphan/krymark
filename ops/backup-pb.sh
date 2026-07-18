#!/usr/bin/env bash
# Backup PocketBase hàng ngày qua API (reliability baseline) — giữ 7 bản mới nhất.
# Cài: cron /etc/cron.d/krymark-backup → 0 17 * * * (≈ 3AM Sydney). Log /var/log/krymark-backup.log
set -euo pipefail
cd "$(dirname "$0")/.."
TOKEN=$(grep '^PB_SUPERUSER_TOKEN=' .env | cut -d= -f2-)
NAME="auto-$(date +%Y%m%d-%H%M).zip"
curl -sf -X POST http://127.0.0.1:${PB_ADMIN_PORT:-8091}/api/backups \
  -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"$NAME\"}" > /dev/null
# prune: giữ 7 bản auto mới nhất
ls -1t pb-data/backups/auto-*.zip 2>/dev/null | tail -n +8 | xargs -r rm --
echo "$(date -Is) backup OK: $NAME ($(du -h "pb-data/backups/$NAME" | cut -f1))"
