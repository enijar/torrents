import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import TorrentService from "server/services/torrent-service.js";

const app = new Hono();

const VIDEO_EXTENSIONS = /\.(mp4|mkv|avi|webm|mov)$/i;
const SUBTITLE_EXTENSIONS = /\.(srt|vtt)$/i;
const SUBTITLE_ENGLISH = /eng|english/i;

type TorrentFile = { name: string; path: string };

function encodePath(filePath: string): string {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

app.get("/api/watch/:hash", (c) => {
  const hash = c.req.param("hash");

  return streamSSE(c, async (stream) => {
    const torrentService = new TorrentService();
    let id = 0;

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

    const BROWSER_VIDEO = /\.(mp4|webm)$/i;
    const videoFile =
      files.find((f) => BROWSER_VIDEO.test(f.name)) ??
      files.find((f) => VIDEO_EXTENSIONS.test(f.name));

    const subtitleFiles = files.filter((f) => SUBTITLE_EXTENSIONS.test(f.name));
    const subtitleFile = subtitleFiles.find((f) => SUBTITLE_ENGLISH.test(f.name)) ?? subtitleFiles[0] ?? null;

    const videoUrl = videoFile ? `/api/files/${encodePath(videoFile.path)}` : null;
    const subtitleUrl = subtitleFile ? `/api/files/${encodePath(subtitleFile.path)}` : null;

    await stream.writeSSE({
      id: String(id++),
      event: "done",
      data: JSON.stringify({ videoUrl, subtitleUrl }),
    });
  });
});

export default app;
