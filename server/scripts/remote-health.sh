#!/usr/bin/env bash
# 服务器本机探活。依赖环境变量：REMOTE_DIR
set -euo pipefail

cd "$REMOTE_DIR"
APP_PORT="$(grep -E '^APP_PORT=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
APP_PORT="${APP_PORT:-8787}"

host_code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 \
  "http://127.0.0.1:${APP_PORT}/health" 2>/dev/null || echo "000")
host_code=$(printf '%s' "$host_code" | tr -d '\r\n')
if [ "$host_code" = "200" ]; then
  echo "200"
  exit 0
fi

container_code=$(docker compose --env-file .env exec -T app \
  node -e "require('http').get('http://127.0.0.1:8787/health',r=>{process.stdout.write(String(r.statusCode));process.exit(0)}).on('error',()=>{process.stdout.write('000');process.exit(0)})" \
  2>/dev/null || echo "000")
container_code=$(printf '%s' "$container_code" | tr -d '\r\n')
if [ "$container_code" = "200" ]; then
  echo "200"
  exit 0
fi

echo "host=${host_code} container=${container_code} port=${APP_PORT}"
exit 1
