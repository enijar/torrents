import { describe, it, expect, vi, beforeEach } from "vitest";
import { Op } from "@sequelize/core";

vi.mock("server/models/stream.js", () => ({
  default: {
    findAll: vi.fn(async () => []),
  },
}));

vi.mock("server/services/database.js", () => ({
  default: {
    query: vi.fn(async () => [[]]),
  },
}));

vi.mock("config/index.js", () => ({
  default: {
    DATABASE_DIALECT: "sqlite3",
  },
}));

import app from "server/routes/streams.js";
import Stream from "server/models/stream.js";
import database from "server/services/database.js";

describe("GET /api/genres", () => {
  beforeEach(() => {
    vi.mocked(database.query).mockClear();
  });

  it("returns distinct genres from database", async () => {
    vi.mocked(database.query).mockResolvedValue([
      [{ genre: "Action" }, { genre: "Comedy" }, { genre: "Drama" }],
    ] as any);

    const res = await app.request("/api/genres");
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.genres).toEqual(["Action", "Comedy", "Drama"]);
  });

  it("uses SQLite json_each query for sqlite3 dialect", async () => {
    vi.mocked(database.query).mockResolvedValue([[] as any]);
    await app.request("/api/genres");

    const query = vi.mocked(database.query).mock.calls[0][0] as string;
    expect(query).toContain("json_each");
    expect(query).not.toContain("JSON_TABLE");
  });
});

describe("GET /api/streams", () => {
  beforeEach(() => {
    vi.mocked(Stream.findAll).mockClear();
    vi.mocked(Stream.findAll).mockResolvedValue([] as any);
  });

  it("adds genre filter when genre param is present", async () => {
    await app.request("/api/streams?genre=Action");

    const where = vi.mocked(Stream.findAll).mock.calls[0][0]?.where as any;
    expect(where[Op.and]).toBeDefined();
  });

  it("does not add genre filter when genre param is absent", async () => {
    await app.request("/api/streams");

    const where = vi.mocked(Stream.findAll).mock.calls[0][0]?.where as any;
    expect(where[Op.and]).toBeUndefined();
  });

  it("combines search and genre filters", async () => {
    await app.request("/api/streams?search=Matrix&genre=Action");

    const where = vi.mocked(Stream.findAll).mock.calls[0][0]?.where as any;
    expect(where.title).toBeDefined();
    expect(where[Op.and]).toBeDefined();
  });

  it("returns null offset when fewer results than limit", async () => {
    vi.mocked(Stream.findAll).mockResolvedValue([{ title: "Solo" }] as any);

    const res = await app.request("/api/streams?genre=Action");
    const data = await res.json();
    expect(data.offset).toBeNull();
  });
});
