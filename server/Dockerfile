# 多阶段构建：先编译 TypeScript，再产出精简运行镜像
# NODE_IMAGE / NPM_REGISTRY 可在国内服务器构建时覆盖为加速源。
ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE} AS builder
ARG NPM_REGISTRY=
WORKDIR /app
COPY package.json package-lock.json* ./
RUN set -eux; \
  if [ -n "$NPM_REGISTRY" ]; then \
    npm config set registry "$NPM_REGISTRY"; \
    if [ -f package-lock.json ]; then \
      sed -i "s#https://registry.npmjs.org#${NPM_REGISTRY}#g" package-lock.json; \
    fi; \
  fi; \
  npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE} AS runner
ARG NPM_REGISTRY=
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN set -eux; \
  if [ -n "$NPM_REGISTRY" ]; then \
    npm config set registry "$NPM_REGISTRY"; \
    if [ -f package-lock.json ]; then \
      sed -i "s#https://registry.npmjs.org#${NPM_REGISTRY}#g" package-lock.json; \
    fi; \
  fi; \
  npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 8787
CMD ["node", "dist/index.js"]
