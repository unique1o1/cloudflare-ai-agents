import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        main: "./src/server.ts",

        miniflare: {
          compatibilityFlags: ["export_commonjs_default"],
          durableObjects: {
            NAME: "Chat",
          },
        },
        // wrangler: { configPath: "./wrangler.jsonc" },
      },
    },
  },
});
