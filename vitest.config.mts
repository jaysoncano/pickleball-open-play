import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["lib/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      // React hook wrappers and the server-only DB/cookie glue; the logic
      // they call is tested.
      exclude: [
        "lib/**/*.test.ts",
        "lib/queue/store.ts",
        "lib/use-now.ts",
        "lib/db/client.ts",
        "lib/auth-server.ts",
      ],
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
    },
  },
});
