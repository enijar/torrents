import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { Op } from "@sequelize/core";
import TorrentService from "server/services/torrent-service.js";
import CachedStream from "server/models/cached-stream.js";

const app = new Hono();

const VIDEO_EXTENSIONS = /\.(mp4|mkv|avi|webm|mov)$/i;
const SUBTITLE_EXTENSIONS = /\.(srt|vtt)$/i;
const SUBTITLE_ENGLISH = /eng|english/i;

type TorrentFile = { name: string; path: string };

const TTL_MS = 24 * 60 * 60 * 1000;

function encodePath(filePath: string): string {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

function pickFiles(files: TorrentFile[]) {
  const BROWSER_VIDEO = /\.(mp4|webm)$/i;
  const videoFile =
    files.find((f) => BROWSER_VIDEO.test(f.name)) ??
    files.find((f) => VIDEO_EXTENSIONS.test(f.name));

  const subtitleFiles = files.filter((f) => SUBTITLE_EXTENSIONS.test(f.name));
  const subtitleFile = subtitleFiles.find((f) => SUBTITLE_ENGLISH.test(f.name)) ?? subtitleFiles[0] ?? null;

  const videoUrl = videoFile ? `/api/files/${encodePath(videoFile.path)}` : null;
  const subtitleUrl = subtitleFile ? `/api/files/${encodePath(subtitleFile.path)}` : null;

  return { videoUrl, subtitleUrl };
}

app.get("/api/watch/:hash", (c) => {
  const hash = c.req.param("hash");

  return streamSSE(c, async (stream) => {
    let id = 0;

    // Check cache for a non-expired entry
    const cached = await CachedStream.findOne({
      where: { hash, expiresAt: { [Op.gt]: new Date() } },
    });

    if (cached) {
      const files = cached.files as TorrentFile[];
      await stream.writeSSE({
        id: String(id++),
        event: "metadata",
        data: JSON.stringify({ name: cached.name, files }),
      });

      const { videoUrl, subtitleUrl } = pickFiles(files);
      await stream.writeSSE({
        id: String(id++),
        event: "done",
        data: JSON.stringify({ videoUrl, subtitleUrl }),
      });

      // Extend TTL
      cached.expiresAt = new Date(Date.now() + TTL_MS);
      await cached.save();

      // Keep stream open until the client disconnects (es.close() in the
      // browser's "done" handler triggers onAbort). Safety timeout prevents
      // leaked connections if the client never closes.
      await new Promise<void>((resolve) => {
        stream.onAbort(() => resolve());
        setTimeout(resolve, 30_000);
      });
      return;
    }

    // Cache miss — download normally
    const torrentService = new TorrentService();

    stream.onAbort(() => {
      torrentService.destroy();
    });

    let metadata: { name: string; files: TorrentFile[] } | null = null;

    torrentService.on<{ name: string; files: TorrentFile[] }>("metadata", (data) => {
      metadata = data;
      stream.writeSSE({ id: String(id++), event: "metadata", data: JSON.stringify(data) });
    });

    torrentService.on<{ progress: number; speed: string; peers: number }>("progress", (data) => {
      stream.writeSSE({ id: String(id++), event: "progress", data: JSON.stringify(data) });
    });

    await torrentService.download(hash);

    const meta = metadata as { name: string; files: TorrentFile[] } | null;
    const files = meta?.files ?? [];

    const { videoUrl, subtitleUrl } = pickFiles(files);

    await stream.writeSSE({
      id: String(id++),
      event: "done",
      data: JSON.stringify({ videoUrl, subtitleUrl }),
    });

    // Upsert cache entry
    if (meta) {
      await CachedStream.upsert({
        hash,
        name: meta.name,
        files: meta.files,
        expiresAt: new Date(Date.now() + TTL_MS),
      });
    }
  });
});

export default app;
