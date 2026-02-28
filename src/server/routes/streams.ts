import { Hono } from "hono";
import database from "server/services/database.js";

const app = new Hono();

app.get("/api/streams", async (c) => {
  const search = c.req.query("search") ?? "";
  const offset = parseInt(c.req.query("offset") ?? "0", 10) || 0;
  const limit = 20;

  let where = "WHERE year <= 2026 AND rating > 0 AND seeds > 0";
  const replacements: Record<string, string | number> = { limit, offset };

  if (search.trim()) {
    where += " AND title LIKE :search";
    replacements.search = `%${search.trim()}%`;
  }

  const [streams] = await database.query(
    `SELECT * FROM streams ${where} ORDER BY popularity DESC, rating DESC, year DESC LIMIT :limit OFFSET :offset`,
    { replacements },
  );

  return c.json({
    streams,
    offset: streams.length < limit ? null : offset + limit,
  });
});

export default app;
