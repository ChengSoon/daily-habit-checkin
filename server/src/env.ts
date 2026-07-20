import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

/**
 * 加载服务端环境变量。
 *
 * 会读这些文件（后者覆盖前者）：
 *   1. 仓库根 `.env.dev` / `.env.prod`（App 与 Server 共用）
 *   2. `server/.env.dev` / `server/.env.prod`
 *   3. `server/.env`（本机/Docker 常用：DATABASE_URL、JWT 等）
 *   4. 对应的 `*.local` 覆盖文件
 *
 * 之前只读 `.env.dev`，不读 `server/.env`，会导致你在 server/.env 配了 DATABASE_URL 却提示未设置。
 */
function envFileSuffix(): "dev" | "prod" {
  return process.env.APP_ENV === "production" || process.env.APP_ENV === "prod" ? "prod" : "dev";
}

function loadEnvFile(envPath: string, override: boolean): void {
  if (!fs.existsSync(envPath)) {
    return;
  }
  dotenv.config({ path: envPath, override, quiet: true });
}

function loadRootEnv(): void {
  const suffix = envFileSuffix();
  const cwd = process.cwd();
  const parent = path.resolve(cwd, "..");

  // 先铺底（不强制 override），再让 server/.env 与 *.local 覆盖
  loadEnvFile(path.resolve(parent, `.env.${suffix}`), false);
  loadEnvFile(path.resolve(cwd, `.env.${suffix}`), false);
  loadEnvFile(path.resolve(cwd, ".env"), true);
  loadEnvFile(path.resolve(parent, `.env.${suffix}.local`), true);
  loadEnvFile(path.resolve(cwd, `.env.${suffix}.local`), true);
  loadEnvFile(path.resolve(cwd, ".env.local"), true);
}

loadRootEnv();
