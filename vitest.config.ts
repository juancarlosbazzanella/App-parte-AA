import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Keep tests independent of the deployment plugins and local credentials.
  envDir: false,
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/auth-policy.ts", "src/lib/climagest.ts", "src/components/auth-screen.tsx", "src/components/climagest-app.tsx"],
      reporter: ["text", "html"],
    },
  },
});
