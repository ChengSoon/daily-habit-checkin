const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("wasm");

// 强制 three 只解析到一份 ESM，避免 R3F import 与业务 require 各打一份导致 InstancedMesh/材质失效（黑屏）
// 注意：three 的 exports 未导出 ./package.json，只能从主入口（build/three.cjs）同目录定位
const threeModulePath = path.join(
  path.dirname(require.resolve("three")),
  "three.module.js"
);
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three") {
    return { filePath: threeModulePath, type: "sourceFile" };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

const enhanceMiddleware = config.server?.enhanceMiddleware;

config.server = {
  ...config.server,
  enhanceMiddleware(middleware, server) {
    const enhanced = enhanceMiddleware ? enhanceMiddleware(middleware, server) : middleware;

    return (req, res, next) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      return enhanced(req, res, next);
    };
  }
};

module.exports = config;
