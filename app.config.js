const base = require("./app.json");

const PROD_API_BASE_URL = "http://111.228.40.252:4000/habit";
const DEV_API_BASE_URL = "http://127.0.0.1:8787";
const PROD_R2_PUBLIC_BASE = "https://lcvv.eu.org";
const DEV_R2_PUBLIC_BASE = "https://lzch.eu.org";

module.exports = ({ config }) => {
  const appEnv = process.env.APP_ENV === "production" ? "production" : "development";
  const apiBaseUrl =
    process.env.API_BASE_URL ??
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    (appEnv === "production" ? PROD_API_BASE_URL : DEV_API_BASE_URL);
  const r2PublicBase =
    process.env.R2_PUBLIC_BASE ??
    process.env.EXPO_PUBLIC_R2_PUBLIC_BASE ??
    (appEnv === "production" ? PROD_R2_PUBLIC_BASE : DEV_R2_PUBLIC_BASE);

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
