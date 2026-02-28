import { Agent } from "undici";
import { SocksClient } from "socks";
import tls from "tls";
import config from "config/index.js";

const agent = new Agent({
  async connect(opts, cb) {
    let port = parseInt(opts.port);
    if (!isFinite(port)) {
      port = 0;
    }
    if (port === 0 && opts.protocol.startsWith("http")) {
      port = opts.protocol === "https:" ? 443 : 80;
    }
    try {
      const { socket } = await SocksClient.createConnection({
        proxy: {
          host: config.PROXY_HOST,
          port: config.PROXY_PORT,
          type: 5,
          userId: config.PROXY_USERNAME,
          password: config.PROXY_PASSWORD,
        },
        command: "connect",
        destination: {
          host: opts.hostname,
          port,
        },
      });
      if (opts.protocol === "https:") {
        const tlsSocket = tls.connect({
          socket,
          servername: opts.hostname,
        });
        cb(null, tlsSocket);
      } else {
        cb(null, socket);
      }
    } catch (err) {
      cb(err as Error, null);
    }
  },
});

export default agent;
