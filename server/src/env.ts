import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

function unique(paths: string[]): string[] {
  return [...new Set(paths)];
}

function envFileSuffix(): "dev" | "prod" {
  return process.env.APP_ENV === "production" || process.env.APP_ENV === "prod" ? "prod" : "dev";
}

function loadRootEnv(): void {
  const suffix = envFileSuffix();
  const parentEnv = path.resolve(process.cwd(), "..", `.env.${suffix}`);
  const currentEnv = path.resolve(process.cwd(), `.env.${suffix}`);
  const candidates = fs.existsSync(parentEnv) ? [parentEnv] : unique([currentEnv]);

  for (const envPath of candidates) {
    dotenv.config({ path: envPath, quiet: true });
    dotenv.config({ path: `${envPath}.local`, override: true, quiet: true });
  }
}

loadRootEnv();
