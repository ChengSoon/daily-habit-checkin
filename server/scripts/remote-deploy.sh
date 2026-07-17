#!/usr/bin/env bash
# 在服务器上执行：用国内镜像源构建并重启 habit-app。
# 依赖环境变量：REMOTE_DIR、NODE_IMAGE、NPM_REGISTRY（可选）
set -euo pipefail

cd "$REMOTE_DIR"
if [ ! -f .env ]; then
  echo "Missing server env file: expected ${REMOTE_DIR}/.env" >&2
  exit 1
fi

# 历史 CI 写入的 GHCR override 会强制用旧 image，必须清掉
rm -f docker-compose.override.yml

upsert_env() {
  local key="$1"
  local value="$2"
  [ -n "$value" ] || return 0
  if grep -qE "^${key}=" .env 2>/dev/null; then
    if sed --version >/dev/null 2>&1; then
      sed -i "s|^${key}=.*|${key}=${value}|" .env
    else
      sed -i.bak "s|^${key}=.*|${key}=${value}|" .env
      rm -f .env.bak
    fi
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

upsert_env NODE_IMAGE "$NODE_IMAGE"
upsert_env NPM_REGISTRY "${NPM_REGISTRY:-}"

echo "Using server env file: .env"
echo "NODE_IMAGE=${NODE_IMAGE}"
echo "NPM_REGISTRY=${NPM_REGISTRY:-<default>}"
echo "==> 远程构建镜像并重启 app（--no-deps，不动 db 与其他服务）…"
docker compose --env-file .env build app
docker compose --env-file .env up -d --no-deps --force-recreate app
docker compose --env-file .env ps
