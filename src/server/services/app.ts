import { Hono } from "hono";
import { cors } from "hono/cors";
import watchRoute from "server/routes/watch.js";
import filesRoute from "server/routes/files.js";
import streamsRoute from "server/routes/streams.js";
import ytsProxy from "server/routes/yts-proxy.js";

const app = new Hono();

app.use(cors());

app.route("/", watchRoute);
app.route("/", filesRoute);
app.route("/", streamsRoute);
app.get("/api/yts-proxy/*", ytsProxy);

export default app;
