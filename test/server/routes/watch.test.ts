import { describe, it, expect, vi, beforeEach } from "vitest";

let mockFiles = [
  { name: "test.mp4", path: "Test Movie/test.mp4" },
  { name: "english.srt", path: "Test Movie/english.srt" },
];

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
          files: mockFiles,
        });

        emit("progress", { progress: 50, speed: "1.00 MB/s", peers: 5 });

        // download() resolves → the route writes the "done" event afterwards
      }
    },
  };
});

let mockCachedEntry: {
  hash: string;
  name: string;
  files: { name: string; path: string }[];
  expiresAt: Date;
  save: ReturnType<typeof vi.fn>;
} | null = null;

vi.mock("server/models/cached-stream.js", () => {
  return {
    default: {
      findOne: vi.fn(async () => mockCachedEntry),
      upsert: vi.fn(async () => {}),
    },
  };
});

import app from "server/routes/watch.js";
import CachedStream from "server/models/cached-stream.js";

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
  beforeEach(() => {
    mockFiles = [
      { name: "test.mp4", path: "Test Movie/test.mp4" },
      { name: "english.srt", path: "Test Movie/english.srt" },
    ];
    mockCachedEntry = null;
    vi.mocked(CachedStream.findOne).mockClear();
    vi.mocked(CachedStream.upsert).mockClear();
  });

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

  it("prefers .mp4 over .mkv when both are present", async () => {
    mockFiles = [
      { name: "movie.mkv", path: "Test Movie/movie.mkv" },
      { name: "movie.mp4", path: "Test Movie/movie.mp4" },
    ];

    const res = await app.request("/api/watch/abc123");
    const text = await res.text();
    const events = parseSSE(text);

    const done = events.find((e) => e.event === "done");
    const doneData = done!.data as { videoUrl: string; subtitleUrl: string | null };
    expect(doneData.videoUrl).toBe("/api/files/Test%20Movie/movie.mp4");
  });

  it("falls back to .mkv when no .mp4 or .webm exists", async () => {
    mockFiles = [
      { name: "movie.mkv", path: "Test Movie/movie.mkv" },
    ];

    const res = await app.request("/api/watch/abc123");
    const text = await res.text();
    const events = parseSSE(text);

    const done = events.find((e) => e.event === "done");
    const doneData = done!.data as { videoUrl: string; subtitleUrl: string | null };
    expect(doneData.videoUrl).toBe("/api/files/Test%20Movie/movie.mkv");
  });

  it("serves cached stream immediately without downloading", async () => {
    mockCachedEntry = {
      hash: "cached123",
      name: "Cached Movie",
      files: [
        { name: "movie.mp4", path: "Cached Movie/movie.mp4" },
        { name: "english.srt", path: "Cached Movie/english.srt" },
      ],
      expiresAt: new Date(Date.now() + 86400000),
      save: vi.fn(async () => {}),
    };

    const res = await app.request("/api/watch/cached123");
    const text = await res.text();
    const events = parseSSE(text);

    // Should have metadata and done but no progress (no download)
    expect(events.find((e) => e.event === "metadata")).toBeDefined();
    expect(events.find((e) => e.event === "done")).toBeDefined();
    expect(events.find((e) => e.event === "progress")).toBeUndefined();

    const done = events.find((e) => e.event === "done");
    const doneData = done!.data as { videoUrl: string; subtitleUrl: string };
    expect(doneData.videoUrl).toBe("/api/files/Cached%20Movie/movie.mp4");
    expect(doneData.subtitleUrl).toBe("/api/files/Cached%20Movie/english.srt");

    // TTL should have been extended
    expect(mockCachedEntry.save).toHaveBeenCalled();
  });

  it("downloads fresh when cache entry is expired", async () => {
    // findOne returns null for expired entries (the WHERE clause filters them)
    mockCachedEntry = null;

    const res = await app.request("/api/watch/expired123");
    const text = await res.text();
    const events = parseSSE(text);

    // Should have progress (downloaded fresh)
    expect(events.find((e) => e.event === "progress")).toBeDefined();
    expect(events.find((e) => e.event === "done")).toBeDefined();

    // Should upsert cache after download
    expect(CachedStream.upsert).toHaveBeenCalled();
  });
});
