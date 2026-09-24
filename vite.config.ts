import path from "node:path";
import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import config from "./src/config/index.js";

const DEV_MODE = process.env.NODE_ENV === "development";
const SERVER_URL = `http://localhost:${config.PORT}`;

export default function (): UserConfig {
  return defineConfig({
    server: {
      port: parseInt(new URL(config.APP_URL).port),
      host: true,
      proxy: {
        "/api": {
          target: SERVER_URL,
        },
      },
      allowedHosts: ["jamess-mac-pro.local"],
    },
    base: config.BASE_PATH,
    resolve: { tsconfigPaths: true },
    publicDir: path.join(import.meta.dirname, "public"),
    build: {
      outDir: path.join(import.meta.dirname, "build", "client"),
      emptyOutDir: true,
      rolldownOptions: {
        output: { comments: { legal: false } },
      },
    },
    appType: "spa",
    root: path.join("src", "client"),
    clearScreen: false,
    plugins: [
      react({
        include: /\.(tsx?)$/,
      }),
      babel({
        include: /\.(tsx?)$/,
        plugins: [
          [
            "babel-plugin-styled-components",
            {
              ssr: !DEV_MODE,
              fileName: DEV_MODE,
              displayName: DEV_MODE,
              minify: !DEV_MODE,
              pure: !DEV_MODE,
            },
          ],
        ],
      }),
    ],
  });
}
