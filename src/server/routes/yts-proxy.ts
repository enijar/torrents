import type { Context } from "hono";
import { fetch } from "undici";
import agent from "server/services/agent.js";

const PREFIX = "/api/yts-proxy/";

export default async function ytsProxy(ctx: Context) {
  const pathname = ctx.req.path.slice(PREFIX.length);
  const url = new URL("https://yts.bz");
  url.pathname = "/" + pathname;
  const response = await fetch(url, { dispatcher: agent });
  return new Response(Buffer.from(await response.arrayBuffer()), {
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "",
    },
  });
}
