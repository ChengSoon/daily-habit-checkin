import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const sqliteFakePath = fileURLToPath(new URL("./test/fakes/expo-sqlite.ts", import.meta.url));

export default defineConfig({
  test: {
    environment: "node"
  },
  resolve: {
    alias: {
      "expo-sqlite": sqliteFakePath
    }
  }
});
