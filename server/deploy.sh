#!/usr/bin/env bash
#
# 打包并部署打卡工具后端到远程服务器。
#
# 只重建 habit-app 容器（--no-deps），不影响 db，也不碰服务器上的其他服务
# 或已有反向代理路由。
# 远程在容器内编译 TypeScript，本地无需产出 dist。
#
# 用法：
#   ./deploy.sh              打包本地 server 源码 → 远程构建镜像 → 重启 app → 健康检查
#   ./deploy.sh --skip-check 跳过本地 TypeScript 类型检查（部署更快，但少一道保险）
#
# 前置：服务器上 REMOTE_DIR/.env 已配置好正式环境变量。
#
# 国内加速（默认开启）：
#   NODE_IMAGE   默认 docker.m.daocloud.io/library/node:22-alpine
#   NPM_REGISTRY 默认 https://registry.npmmirror.com
#   设 DEPLOY_USE_CN_MIRROR=0 可关闭，改回官方源。

set -euo pipefail

PEM="${DEPLOY_SSH_KEY:-$HOME/.ssh/deploy_key}"
HOST="${DEPLOY_HOST:-deploy@example.com}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/root/habit-server}"
HEALTH_URL="${DEPLOY_HEALTH_URL:-https://your-api.example.com/health}"
SSH_OPTS=(-i "$PEM" -o StrictHostKeyChecking=no -o ConnectTimeout=20)

if [[ "${DEPLOY_USE_CN_MIRROR:-1}" == "1" ]]; then
  NODE_IMAGE="${NODE_IMAGE:-docker.m.daocloud.io/library/node:22-alpine}"
  NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"
else
  NODE_IMAGE="${NODE_IMAGE:-node:22-alpine}"
  NPM_REGISTRY="${NPM_REGISTRY:-}"
fi

LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
cd "$LOCAL_DIR"

if [[ "${1:-}" != "--skip-check" ]]; then
  echo "==> 本地 TypeScript 类型检查…"
  npm run build >/dev/null
  echo "    通过。"
fi

echo "==> 打包源码并推送到 ${HOST}:${REMOTE_DIR} …"
echo "    NODE_IMAGE=${NODE_IMAGE}"
echo "    NPM_REGISTRY=${NPM_REGISTRY:-<default>}"
STAGE_DIR="$TMP_DIR/deploy"
mkdir -p "$STAGE_DIR"
cp -R src Dockerfile package.json package-lock.json tsconfig.json docker-compose.yml "$STAGE_DIR/"
cp scripts/remote-deploy.sh scripts/remote-health.sh "$STAGE_DIR/"

COPYFILE_DISABLE=1 tar czf "$TMP_DIR/src.tgz" \
  --exclude='._*' --exclude='.DS_Store' \
  -C "$STAGE_DIR" .

scp "${SSH_OPTS[@]}" "$TMP_DIR/src.tgz" \
  "$STAGE_DIR/remote-deploy.sh" "$STAGE_DIR/remote-health.sh" \
  "$HOST:/tmp/"

ssh "${SSH_OPTS[@]}" "$HOST" \
  env REMOTE_DIR="$REMOTE_DIR" NODE_IMAGE="$NODE_IMAGE" NPM_REGISTRY="$NPM_REGISTRY" \
  bash -s <<'BOOT'
set -euo pipefail
mkdir -p "$REMOTE_DIR"
rm -rf "$REMOTE_DIR/src"
tar xzf /tmp/src.tgz -C "$REMOTE_DIR"
# remote-deploy 依赖 REMOTE_DIR 下的 compose/Dockerfile
install -m 755 /tmp/remote-deploy.sh /tmp/remote-health.sh "$REMOTE_DIR/" 2>/dev/null || {
  cp /tmp/remote-deploy.sh /tmp/remote-health.sh "$REMOTE_DIR/"
  chmod +x "$REMOTE_DIR/remote-deploy.sh" "$REMOTE_DIR/remote-health.sh"
}
bash "$REMOTE_DIR/remote-deploy.sh"
rm -f /tmp/src.tgz /tmp/remote-deploy.sh /tmp/remote-health.sh
BOOT

echo "==> 等待服务就绪…"
sleep 3
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL" || true)
if [[ "$code" == "200" ]]; then
  echo "==> 部署成功，健康检查 200：$HEALTH_URL"
  exit 0
fi

code=$(ssh "${SSH_OPTS[@]}" "$HOST"   env REMOTE_DIR="$REMOTE_DIR" bash "$REMOTE_DIR/remote-health.sh" 2>/dev/null || true)
code=$(printf '%s\n' "$code" | tail -n 1 | tr -d '\r')
if [[ "$code" == "200" ]]; then
  echo "==> 部署成功，健康检查 200（SSH 本机探活）"
  exit 0
fi

echo "!! 健康检查未返回 200（实际：$code）。查看容器日志：" >&2
echo "   ssh -i $PEM $HOST 'cd $REMOTE_DIR && docker compose logs --tail=50 app'" >&2
exit 1
