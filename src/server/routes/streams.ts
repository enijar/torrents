import { Hono } from "hono";
import { Op, sql } from "@sequelize/core";
import Stream from "server/models/stream.js";
import database from "server/services/database.js";
import config from "config/index.js";

const app = new Hono();

app.get("/api/genres", async (c) => {
  const query =
    config.DATABASE_DIALECT === "mysql"
      ? `SELECT DISTINCT jt.genre FROM streams, JSON_TABLE(streams.genres, '$[*]' COLUMNS(genre VARCHAR(100) PATH '$')) AS jt WHERE rating > 0 AND seeds > 0 ORDER BY genre`
      : `SELECT DISTINCT value AS genre FROM streams, json_each(streams.genres) WHERE rating > 0 AND seeds > 0 ORDER BY genre`;

  const [results] = await database.query(query);
  const genres = (results as { genre: string }[]).map((r) => r.genre);
  return c.json({ genres });
});

app.get("/api/streams", async (c) => {
  const search = c.req.query("search") ?? "";
  const genre = c.req.query("genre") ?? "";
  const offset = parseInt(c.req.query("offset") ?? "0", 10) || 0;
  const limit = 20;

  const where: Record<string | symbol, unknown> = {
    year: { [Op.lte]: 2026 },
    rating: { [Op.gt]: 0 },
    seeds: { [Op.gt]: 0 },
  };

  if (search.trim()) {
    where.title = { [Op.like]: `%${search.trim()}%` };
  }

  if (genre.trim()) {
    const pattern = `%"${genre.trim()}"%`;
    where[Op.and] = [sql`genres LIKE ${pattern}`];
  }

  const streams = await Stream.findAll({
    attributes: [
      "uuid",
      "apiId",
      "title",
      "year",
      "rating",
      "genres",
      "largeCoverImage",
      "torrents",
      "seeds",
      "popularity",
    ],
    where,
    order: [
      ["popularity", "DESC"],
      ["rating", "DESC"],
      ["year", "DESC"],
    ],
    limit,
    offset,
  });

  return c.json({
    streams,
    offset: streams.length < limit ? null : offset + limit,
  });
});

export default app;
