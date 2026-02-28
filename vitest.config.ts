import path from "node:path";
import { defineConfig } from "vitest/config";

const src = path.resolve(import.meta.dirname, "src");

const alias = {
  "client/": `${src}/client/`,
  "server/": `${src}/server/`,
  "config/": `${src}/config/`,
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "server",
          environment: "node",
          include: ["test/server/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        plugins: [(await import("@vitejs/plugin-react")).default()],
        test: {
          name: "client",
          environment: "jsdom",
          include: ["test/client/**/*.test.{ts,tsx}"],
          setupFiles: ["test/setup.ts"],
        },
      },
    ],
  },
});
