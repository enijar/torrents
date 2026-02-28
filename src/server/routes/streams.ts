import { Hono } from "hono";
import { Op } from "@sequelize/core";
import Stream from "server/models/stream.js";

const app = new Hono();

app.get("/api/streams", async (c) => {
  const search = c.req.query("search") ?? "";
  const offset = parseInt(c.req.query("offset") ?? "0", 10) || 0;
  const limit = 20;

  const where: Record<string, unknown> = {
    year: { [Op.lte]: 2026 },
    rating: { [Op.gt]: 0 },
    seeds: { [Op.gt]: 0 },
  };

  if (search.trim()) {
    where.title = { [Op.like]: `%${search.trim()}%` };
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
