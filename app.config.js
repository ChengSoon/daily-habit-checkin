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

function buildPlugins(plugins, allowCleartext) {
  return plugins.map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== "expo-build-properties") {
      return plugin;
    }
    return [
      plugin[0],
      {
        ...plugin[1],
        android: {
          ...plugin[1]?.android,
          usesCleartextTraffic: allowCleartext
        }
      }
    ];
  });
}

function assertProductionUrl(name, value, required, allowHttp = false) {
  if (!value) {
    if (required) throw new Error(`${name} is required for production builds`);
    return;
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL for production builds`);
  }
  const isAllowed = parsed.protocol === "https:" || (allowHttp && parsed.protocol === "http:");
  if (!isAllowed && name === "API_BASE_URL") {
    throw new Error("API_BASE_URL must use HTTPS unless ALLOW_CLEARTEXT_API=true");
  }
  if (!isAllowed) {
    throw new Error(`${name} must use HTTPS for production builds`);
  }
}

module.exports = ({ config }) => {
  const appEnv = envName(process.env.APP_ENV);
  const fileEnv = loadEnvFiles(appEnv);
  const apiBaseUrl = appConfigValue(fileEnv, "API_BASE_URL");
  const r2PublicBase = appConfigValue(fileEnv, "R2_PUBLIC_BASE");
  const allowCleartextApi = appConfigValue(fileEnv, "ALLOW_CLEARTEXT_API").toLowerCase() === "true";
  const allowCleartext = appEnv === "development" || (allowCleartextApi && apiBaseUrl.startsWith("http://"));
  if (appEnv === "production") {
    assertProductionUrl("API_BASE_URL", apiBaseUrl, true, allowCleartextApi);
    assertProductionUrl("R2_PUBLIC_BASE", r2PublicBase, false);
  }

  return {
    ...config,
    ...base.expo,
    ios: {
      ...base.expo.ios,
      infoPlist: {
        ...base.expo.ios?.infoPlist,
        NSAppTransportSecurity: {
          ...base.expo.ios?.infoPlist?.NSAppTransportSecurity,
          NSAllowsArbitraryLoads: allowCleartext
        }
      }
    },
    plugins: buildPlugins(base.expo.plugins, allowCleartext),
    extra: {
      ...base.expo.extra,
      appEnv,
      apiBaseUrl,
      r2PublicBase
    }
  };
};
