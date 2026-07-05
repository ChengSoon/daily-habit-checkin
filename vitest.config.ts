import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const sqliteFakePath = fileURLToPath(new URL("./test/fakes/expo-sqlite.ts", import.meta.url));
const notificationsFakePath = fileURLToPath(new URL("./test/fakes/expo-notifications.ts", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["node_modules/**", "server/node_modules/**", "server/dist/**", "dist/**"]
  },
  resolve: {
    alias: {
      "expo-sqlite": sqliteFakePath,
      "expo-notifications": notificationsFakePath
    }
  }
});
