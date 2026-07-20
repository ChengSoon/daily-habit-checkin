#!/usr/bin/env bash
# 本机 Docker 启动后端（db + app）
set -euo pipefail
cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  echo "Docker 未运行或当前终端无权访问 Docker。请先打开 Docker Desktop。"
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "缺少 server/.env"
  exit 1
fi

echo "==> 构建并启动（docker-compose.local.yml）…"
docker compose -f docker-compose.local.yml --env-file .env up -d --build

echo "==> 等待健康检查…"
for i in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${APP_PORT:-8787}/health" >/dev/null 2>&1; then
    echo "OK  http://127.0.0.1:${APP_PORT:-8787}/health"
    docker compose -f docker-compose.local.yml --env-file .env ps
    echo
    echo "查看日志: docker compose -f docker-compose.local.yml logs -f app"
    echo "期望日志含: 个推提醒调度已启动 / 数据库表已就绪"
    exit 0
  fi
  sleep 2
done

echo "启动超时，最近日志："
docker compose -f docker-compose.local.yml --env-file .env logs --tail=80 app
exit 1
