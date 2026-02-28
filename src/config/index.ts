import path from "node:path";
import fs from "node:fs";
import { config as dotenv } from "@dotenvx/dotenvx";
import { z } from "zod/v4";

const envFiles = {
  dev: path.join(import.meta.dirname, "..", "..", ".env.dev"),
  prod: path.join(import.meta.dirname, "..", "..", ".env.prod"),
  local: path.join(import.meta.dirname, "..", "..", ".env.local"),
};
let envFile = process.env.NODE_ENV === "development" ? envFiles.dev : envFiles.prod;
let env = {};
if (fs.existsSync(envFile)) {
  env = dotenv({ path: envFile, quiet: true }).parsed ?? {};
}
if (fs.existsSync(envFiles.local)) {
  env = { ...env, ...(dotenv({ path: envFiles.local, quiet: true, override: true }).parsed ?? {}) };
}

const config = z
  .object({
    PORT: z.coerce.number().gte(0).lte(65535),
    APP_URL: z.url().nonempty(),
    DATABASE_DIALECT: z.enum(["sqlite3", "mysql"]),
    DATABASE_URL: z.string().nonempty(),
    BASE_PATH: z.string().nonempty(),
    PROXY_HOST: z.string().nonempty(),
    PROXY_PORT: z.coerce.number(),
    PROXY_USERNAME: z.string().nonempty(),
    PROXY_PASSWORD: z.string().nonempty(),
  })
  .parse({ ...env, ...process.env });

export default config;
