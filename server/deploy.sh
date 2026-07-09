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
#       本脚本不会传输或覆盖服务器上的 .env。

set -euo pipefail

# ---- 配置 ----
PEM="${DEPLOY_SSH_KEY:-$HOME/.ssh/deploy_key}"
HOST="${DEPLOY_HOST:-deploy@example.com}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/root/habit-server}"
HEALTH_URL="${DEPLOY_HEALTH_URL:-https://your-api.example.com/health}"
SSH_OPTS=(-i "$PEM" -o StrictHostKeyChecking=no -o ConnectTimeout=20)

# 脚本所在目录即本地 server 目录，无论从哪里调用都能定位到源码。
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$LOCAL_DIR/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
cd "$LOCAL_DIR"

# ---- 1. 本地类型检查（可用 --skip-check 跳过）----
if [[ "${1:-}" != "--skip-check" ]]; then
  echo "==> 本地 TypeScript 类型检查…"
  npm run build >/dev/null
  echo "    通过。"
fi

# ---- 2. 打包源码 → 传输 → 远程构建并重启 ----
# 只同步构建镜像所需的文件；排除 node_modules/dist/测试与 macOS 元数据（._* / .DS_Store）。
# COPYFILE_DISABLE=1 阻止 bsdtar 塞进 AppleDouble 元数据文件。
echo "==> 打包源码并推送到 ${HOST}:${REMOTE_DIR} …"
STAGE_DIR="$TMP_DIR/deploy"
mkdir -p "$STAGE_DIR"
cp -R src Dockerfile package.json package-lock.json tsconfig.json docker-compose.yml "$STAGE_DIR/"
COPYFILE_DISABLE=1 tar czf - \
  --exclude='._*' --exclude='.DS_Store' \
  -C "$STAGE_DIR" . \
  | ssh "${SSH_OPTS[@]}" "$HOST" "
      set -e
      mkdir -p '$REMOTE_DIR'
      tar xzf - -C '$REMOTE_DIR'
      cd '$REMOTE_DIR'
      if [ ! -f .env ]; then
        echo 'Missing server env file: expected /root/habit-server/.env' >&2
        exit 1
      fi
      echo 'Using server env file: .env'
      echo '==> 远程构建镜像并重启 app（--no-deps，不动 db 与其他服务）…'
      docker compose --env-file .env build app
      docker compose --env-file .env up -d --no-deps app
      docker compose --env-file .env ps
    "

# ---- 3. 健康检查 ----
echo "==> 等待服务就绪…"
sleep 3
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL" || true)
if [[ "$code" == "200" ]]; then
  echo "==> 部署成功，健康检查 200：$HEALTH_URL"
else
  echo "!! 健康检查未返回 200（实际：$code）。查看容器日志：" >&2
  echo "   ssh -i $PEM $HOST 'cd $REMOTE_DIR && docker compose logs --tail=50 app'" >&2
  exit 1
fi
