const { withAppBuildGradle, withAndroidManifest, withProjectBuildGradle } = require("@expo/config-plugins");

const GETUI_MAVEN = 'maven { url "https://mvn.getui.com/nexus/content/repositories/releases/" }';

function appIdFromConfig(config) {
  const appId = config.extra?.getuiAppId || process.env.GETUI_APPID || process.env.EXPO_PUBLIC_GETUI_APPID;
  if (!appId) {
    throw new Error("Getui requires GETUI_APPID in .env.dev/.env.prod or the build environment.");
  }
  return appId;
}

function withGetuiProjectRepository(config) {
  return withProjectBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes(GETUI_MAVEN)) {
      mod.modResults.contents += `\nallprojects { repositories { ${GETUI_MAVEN} } }\n`;
    }
    return mod;
  });
}

function withGetuiAppGradle(config) {
  return withAppBuildGradle(config, (mod) => {
    const appId = appIdFromConfig(config).replaceAll('"', '\\"');
    if (!mod.modResults.contents.includes("GETUI_APPID")) {
      mod.modResults.contents = mod.modResults.contents.replace(
        /defaultConfig\s*\{/,
        `defaultConfig {\n        manifestPlaceholders = [GETUI_APPID: "${appId}"]`
      );
    }
    return mod;
  });
}

function withGetuiManifest(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application) {
      application.$ = {
        ...application.$,
        "android:usesCleartextTraffic": "true"
      };
    }
    const manifest = mod.modResults.manifest;
    manifest.queries ??= [];
    const queries = manifest.queries[0] ?? { intent: [] };
    queries.intent ??= [];
    if (!queries.intent.some((item) => item.action?.some((action) => action.$?.["android:name"] === "com.getui.sdk.action"))) {
      queries.intent.push({ action: [{ $: { "android:name": "com.getui.sdk.action" } }] });
    }
    manifest.queries[0] = queries;
    return mod;
  });
}

module.exports = function withGetui(config) {
  return withGetuiManifest(withGetuiAppGradle(withGetuiProjectRepository(config)));
};
