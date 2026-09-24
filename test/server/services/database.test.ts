import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Op, Sequelize } from "@sequelize/core";
import { SqliteDialect } from "@sequelize/sqlite3";
import Stream from "server/models/stream.js";
import CachedStream from "server/models/cached-stream.js";

let directory: string;
let database: Sequelize;

beforeAll(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "torrents-database-test-"));
  database = new Sequelize({
    dialect: SqliteDialect,
    storage: path.join(directory, "database.sqlite"),
    models: [Stream, CachedStream],
    logging: false,
  });
  await database.sync();
});

beforeEach(async () => {
  await Stream.destroy({ where: {} });
  await CachedStream.destroy({ where: {} });
});

afterAll(async () => {
  await database?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

describe("SQLite driver compatibility", () => {
  it("preserves catalog data through bulk upserts and schema sync", async () => {
    const movie = {
      apiId: 1,
      title: "A Movie's Title",
      year: 2024,
      rating: 8.5,
      genres: ["Drama", "Comedy"],
      torrents: [
        {
          hash: "test",
          quality: "1080p",
          videoCodec: "x264",
          size: 2239,
          seeds: 5,
        },
      ],
    };
    await Stream.bulkCreate([movie]);
    await Stream.bulkCreate([{ ...movie, rating: 9 }], {
      updateOnDuplicate: ["rating"],
    });
    await database.sync({ alter: true });

    const stored = await Stream.findOne({
      where: { apiId: 1 },
      rejectOnEmpty: true,
    });
    expect(await Stream.count()).toBe(1);
    expect(stored.uuid).toMatch(/^[a-f0-9-]{36}$/);
    expect(stored.title).toBe(movie.title);
    expect(stored.rating).toBe(9);
    expect(stored.genres).toEqual(movie.genres);
    expect(stored.torrents).toEqual(movie.torrents);
    expect(stored.synopsis).toBeNull();

    const [genres] = await database.query(
      "SELECT DISTINCT value AS genre FROM streams, json_each(streams.genres) ORDER BY genre",
    );
    expect(genres).toEqual([{ genre: "Comedy" }, { genre: "Drama" }]);
  });

  it("upserts cached JSON files and filters expiry dates", async () => {
    const now = new Date("2026-09-24T12:00:00.000Z");
    const expired = new Date(now.getTime() - 60_000);
    const future = new Date(now.getTime() + 60_000);
    const cached = {
      hash: "cached",
      name: "Cached Movie",
      files: [{ name: "movie.mp4", path: "Cached Movie/movie.mp4" }],
      expiresAt: expired,
    };
    await CachedStream.upsert(cached);
    await CachedStream.upsert({ ...cached, expiresAt: future });
    await CachedStream.create({ ...cached, hash: "expired" });

    const active = await CachedStream.findAll({
      where: { expiresAt: { [Op.gt]: now } },
    });
    expect(active).toHaveLength(1);
    expect(active[0].files).toEqual(cached.files);
    expect(active[0].expiresAt).toEqual(future);
    expect(await CachedStream.destroy({ where: { expiresAt: { [Op.lte]: now } } })).toBe(1);
    expect(await CachedStream.count()).toBe(1);
  });

  it("rolls back writes when a transaction fails", async () => {
    await expect(
      database.transaction(async (transaction) => {
        await Stream.create({ apiId: 2, title: "Rolled back", year: 2024, torrents: [] }, { transaction });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await Stream.count()).toBe(0);
  });
});
