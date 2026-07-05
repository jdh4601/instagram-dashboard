#!/usr/bin/env bash
# 매일 아침 일일 리포트 엔드포인트를 호출한다. launchd에서 실행된다.
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$HOME/Developer/instagram-dashboard}"
ENV_FILE="$PROJECT_DIR/.env"

# .env에서 CRON_SECRET / REPORT_URL 등을 로드 (docker-compose와 동일한 단일 소스)
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

URL="${REPORT_URL:-http://localhost:3000/api/cron/daily-report}"

if [ -z "${CRON_SECRET:-}" ]; then
  echo "[daily-report] CRON_SECRET이 없습니다 ($ENV_FILE 확인)" >&2
  exit 1
fi

echo "[daily-report] $(date '+%Y-%m-%d %H:%M:%S') → POST $URL"
curl -fsS -X POST "$URL" \
  -H "x-cron-secret: ${CRON_SECRET}" \
  --max-time 300
echo ""
echo "[daily-report] 완료"
