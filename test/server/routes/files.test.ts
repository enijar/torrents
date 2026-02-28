import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import app from "server/routes/files.js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const FILES_DIR = path.join(PROJECT_ROOT, "files");
const TEST_DIR = path.join(FILES_DIR, "__test_torrent__");
const FIXTURES = path.join(PROJECT_ROOT, "test", "fixtures");

beforeAll(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.copyFileSync(path.join(FIXTURES, "test.mp4"), path.join(TEST_DIR, "test.mp4"));
  fs.copyFileSync(path.join(FIXTURES, "test.srt"), path.join(TEST_DIR, "test.srt"));
});

afterAll(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("GET /api/files/*", () => {
  it("serves video with correct content type", async () => {
    const res = await app.request("/api/files/__test_torrent__/test.mp4");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("video/mp4");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
  });

  it("returns correct Content-Length", async () => {
    const res = await app.request("/api/files/__test_torrent__/test.mp4");
    const stat = fs.statSync(path.join(TEST_DIR, "test.mp4"));
    expect(res.headers.get("content-length")).toBe(String(stat.size));
  });

  it("handles range requests with 206 Partial Content", async () => {
    const res = await app.request("/api/files/__test_torrent__/test.mp4", {
      headers: { Range: "bytes=0-99" },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toMatch(/^bytes 0-99\/\d+$/);
    expect(res.headers.get("content-length")).toBe("100");
  });

  it("converts SRT to VTT with WEBVTT header", async () => {
    const res = await app.request("/api/files/__test_torrent__/test.srt");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/vtt");
    const text = await res.text();
    expect(text).toMatch(/^WEBVTT/);
    // timestamps should use dots, not commas
    expect(text).toContain("00:00:00.000");
    expect(text).not.toContain("00:00:00,000");
  });

  it("blocks path traversal with 403", async () => {
    // URL-encode the dots so the path isn't normalized before reaching the handler
    const res = await app.request("/api/files/..%2F..%2Fetc%2Fpasswd");
    expect(res.status).toBe(403);
  });

  it("returns 404 for missing files", async () => {
    const res = await app.request("/api/files/__test_torrent__/nonexistent.mp4");
    expect(res.status).toBe(404);
  });
});
