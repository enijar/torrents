import { describe, it, expect, vi } from "vitest";

vi.mock("server/services/torrent-service.js", () => {
  return {
    default: class MockTorrentService {
      private events = new Map<string, Function[]>();

      on(event: string, fn: Function) {
        this.events.set(event, (this.events.get(event) ?? []).concat(fn));
      }

      destroy() {}

      async download(_hash: string) {
        const emit = (event: string, data?: unknown) => {
          for (const fn of this.events.get(event) ?? []) fn(data);
        };

        emit("metadata", {
          name: "Test Movie",
          files: [
            { name: "test.mp4", path: "Test Movie/test.mp4" },
            { name: "english.srt", path: "Test Movie/english.srt" },
          ],
        });

        emit("progress", { progress: 50, speed: "1.00 MB/s", peers: 5 });

        // download() resolves → the route writes the "done" event afterwards
      }
    },
  };
});

import app from "server/routes/watch.js";

function parseSSE(text: string) {
  const events: { event: string; data: unknown }[] = [];
  for (const block of text.split("\n\n").filter(Boolean)) {
    let event = "";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data = line.slice(5).trim();
    }
    if (event && data) {
      events.push({ event, data: JSON.parse(data) });
    }
  }
  return events;
}

describe("GET /api/watch/:hash", () => {
  it("streams metadata, progress, and done SSE events", async () => {
    const res = await app.request("/api/watch/abc123");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const text = await res.text();
    const events = parseSSE(text);

    // metadata
    const metadata = events.find((e) => e.event === "metadata");
    expect(metadata).toBeDefined();
    const meta = metadata!.data as { name: string; files: { name: string; path: string }[] };
    expect(meta.name).toBe("Test Movie");
    expect(meta.files).toHaveLength(2);
    expect(meta.files.map((f) => f.name)).toContain("test.mp4");
    expect(meta.files.map((f) => f.name)).toContain("english.srt");

    // progress
    const progress = events.find((e) => e.event === "progress");
    expect(progress).toBeDefined();
    expect(progress!.data).toEqual({ progress: 50, speed: "1.00 MB/s", peers: 5 });

    // done
    const done = events.find((e) => e.event === "done");
    expect(done).toBeDefined();
    const doneData = done!.data as { videoUrl: string; subtitleUrl: string };
    expect(doneData.videoUrl).toBe("/api/files/Test%20Movie/test.mp4");
    expect(doneData.subtitleUrl).toBe("/api/files/Test%20Movie/english.srt");
  });
});
