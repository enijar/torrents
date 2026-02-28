import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";

const app = new Hono();

const FILES_ROOT = path.join(import.meta.dirname, "..", "..", "..", "files");

const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".srt": "application/x-subrip",
  ".vtt": "text/vtt",
  ".txt": "text/plain",
};

function srtToVtt(srt: string): string {
  return "WEBVTT\n\n" + srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
}

app.get("/api/files/*", async (c) => {
  const wildcard = c.req.path.replace("/api/files/", "");
  const decoded = decodeURIComponent(wildcard);
  const resolved = path.resolve(FILES_ROOT, decoded);

  if (!resolved.startsWith(FILES_ROOT)) {
    return c.text("Forbidden", 403);
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolved);
  } catch {
    return c.text("Not Found", 404);
  }

  if (!stat.isFile()) {
    return c.text("Not Found", 404);
  }

  const ext = path.extname(resolved).toLowerCase();

  if (ext === ".srt") {
    const srt = fs.readFileSync(resolved, "utf-8");
    const vtt = srtToVtt(srt);
    return c.body(vtt, 200, {
      "Content-Type": "text/vtt; charset=utf-8",
    });
  }

  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
  const fileSize = stat.size;

  const range = c.req.header("Range");

  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (!match) {
      return c.text("Bad Range", 416);
    }

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      return c.text("Range Not Satisfiable", 416, {
        "Content-Range": `bytes */${fileSize}`,
      });
    }

    const stream = fs.createReadStream(resolved, { start, end });
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk: Buffer) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
      cancel() {
        stream.destroy();
      },
    });

    return new Response(readableStream, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
      },
    });
  }

  const stream = fs.createReadStream(resolved);
  const readableStream = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk: Buffer) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      stream.destroy();
    },
  });

  return new Response(readableStream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
    },
  });
});

export default app;
