const base = require("./app.json");
const fs = require("node:fs");
const path = require("node:path");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return env;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex < 0) {
        return env;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^["']|["']$/g, "");
      return key ? { ...env, [key]: value } : env;
    }, {});
}

function envName(value) {
  return value === "production" || value === "prod" ? "production" : "development";
}

function envFileSuffix(appEnv) {
  return appEnv === "production" ? "prod" : "dev";
}

function loadEnvFiles(appEnv) {
  const suffix = envFileSuffix(appEnv);
  const envFile = path.join(__dirname, `.env.${suffix}`);
  const localFile = path.join(__dirname, `.env.${suffix}.local`);
  return {
    ...parseEnvFile(envFile),
    ...parseEnvFile(localFile)
  };
}

function firstValue(env, keys) {
  for (const key of keys) {
    if (env[key]) {
      return env[key];
    }
  }
  return undefined;
}

function appConfigValue(fileEnv, baseName) {
  const processValue = firstValue(process.env, [
    baseName,
    `EXPO_PUBLIC_${baseName}`
  ]);

  if (processValue) {
    return processValue;
  }

  return firstValue(fileEnv, [
    baseName,
    `EXPO_PUBLIC_${baseName}`
  ]) ?? "";
}

module.exports = ({ config }) => {
  const appEnv = envName(process.env.APP_ENV);
  const fileEnv = loadEnvFiles(appEnv);
  const apiBaseUrl = appConfigValue(fileEnv, "API_BASE_URL");
  const r2PublicBase = appConfigValue(fileEnv, "R2_PUBLIC_BASE");

  return {
    ...config,
    ...base.expo,
    extra: {
      ...base.expo.extra,
      appEnv,
      apiBaseUrl,
      r2PublicBase
    }
  };
};
