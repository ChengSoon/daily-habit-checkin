import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const sqliteFakePath = fileURLToPath(new URL("./test/fakes/expo-sqlite.ts", import.meta.url));
const notificationsFakePath = fileURLToPath(new URL("./test/fakes/expo-notifications.ts", import.meta.url));
const apiClientFakePath = fileURLToPath(new URL("./test/fakes/apiClient.ts", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["node_modules/**", "server/node_modules/**", "server/dist/**", "dist/**"]
  },
  resolve: {
    alias: {
      "expo-sqlite": sqliteFakePath,
      "expo-notifications": notificationsFakePath,
      // 仓储层通过 apiClient 访问后端；测试里换成内存 syncBackend 替身。
      // 注意：目前没有任何测试验证真实 apiClient/authService，故全局 alias 安全。
      "./apiClient": apiClientFakePath
    }
  }
});
