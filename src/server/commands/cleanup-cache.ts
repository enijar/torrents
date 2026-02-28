import fs from "node:fs/promises";
import path from "node:path";
import { Op } from "@sequelize/core";
import CachedStream from "server/models/cached-stream.js";

const FILES_DIR = path.join(process.cwd(), "files");

export default async function cleanupCache(): Promise<void> {
  const expired = await CachedStream.findAll({
    where: { expiresAt: { [Op.lt]: new Date() } },
  });

  for (const entry of expired) {
    const dir = path.join(FILES_DIR, entry.name);
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // Directory may already be gone
    }
    await entry.destroy();
  }

  if (expired.length > 0) {
    console.log(`[cleanup-cache] Removed ${expired.length} expired entries`);
  }
}
