#!/usr/bin/env bash
# KryDeploy v3 (00-templates/krycms/DEPLOY-STANDARD.md) — deploy tay, git là nguồn sự thật.
# Config nằm ở .deploy.env (GITIGNORED — mỗi người tự điền, xem deploy.env.example)
set -euo pipefail
cd "$(dirname "$0")"
ENV_FILE="${1:-.deploy.env}"
[ -f "$ENV_FILE" ] || { echo "✋ thiếu $ENV_FILE — cp deploy.env.example $ENV_FILE rồi điền"; exit 1; }
. "./$ENV_FILE"

SECONDS=0

# 1) Guard: LIVE phải == GitHub
[ -n "$(git status --porcelain)" ] && { echo "✋ commit + push trước"; git status --short; exit 1; }
git push -q

# 2) Delta lên VPS (.env giữ nguyên nhờ .gitignore)
OLD=$(ssh -i "$KEY" "$VPS" "cd $APP_DIR && git rev-parse HEAD")
NEW=$(git rev-parse HEAD)
[ "$OLD" = "$NEW" ] && { echo "✓ không có gì mới"; exit 0; }
git push -q "${GIT_REMOTE:-vps}" master
ssh -i "$KEY" "$VPS" "cd $APP_DIR && git clean -fd -q"

# Smart skip: chỉ docs đổi → khỏi build
if [ -z "$(git diff --name-only "$OLD" "$NEW" | grep -vE '\.(md|txt)$' || true)" ]; then
  echo "✅ sync docs xong (${SECONDS}s) — app giữ nguyên"; exit 0
fi

# 3) Build + swap — CHỈ build app (build cả stack làm pb đổi image-id vì provenance
#    metadata → compose recreate pb mỗi deploy vô ích). PB upgrade = build tay.
#    set -o pipefail để build fail KHÔNG bị exit code của pipe nuốt (bài học 0.7.0).
ssh -i "$KEY" "$VPS" "set -eo pipefail; cd $APP_DIR && docker compose build app && docker compose up -d app && docker exec $PROXY nginx -s reload 2>/dev/null"

# 4) Health poll — /api/health (/, giờ redirect 307 vì LDP tắt)
code=000
for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$URL/api/health" || echo 000)
  [ "$code" = "200" ] && break; sleep 1
done
[ "$code" = "200" ] && echo "✅ LIVE: $URL (${SECONDS}s)" || { echo "⚠️ health=$code — docker logs --tail 60 $APP_CT"; exit 1; }
