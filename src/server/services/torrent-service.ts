import path from "node:path";
import WebTorrent from "webtorrent";

type Events = "metadata" | "progress" | "done";
type Fn<T = any> = (...args: T[]) => any;

export default class TorrentService {
  private readonly client = new WebTorrent();
  private events = new Map<Events, Fn[]>();
  private interval: ReturnType<typeof setInterval> | null = null;

  private emit<T = any>(event: Events, ...args: T[]) {
    for (const fn of this.events.get(event) ?? []) {
      fn(...args);
    }
  }

  on<T>(event: Events, fn: Fn<T>) {
    const fns = (this.events.get(event) ?? []).concat(fn);
    this.events.set(event, fns);
  }

  download(hash: string) {
    return new Promise((resolve, reject) => {
      const torrent = this.client.add(`magnet:?xt=urn:btih:${hash}`, {
        path: path.join(import.meta.dirname, "..", "..", "..", "files"),
        announce: [
          "udp://tracker.opentrackr.org:1337/announce",
          "udp://open.tracker.cl:1337/announce",
          "udp://tracker.openbittorrent.com:6969/announce",
        ],
      });
      torrent.on("metadata", () => {
        this.emit("metadata", {
          name: torrent.name,
          files: torrent.files.map((file) => file.name),
        });
      });
      torrent.on("ready", () => {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => {
          this.emit("progress", {
            progress: Math.round(torrent.progress * 100),
            speed: `${(torrent.downloadSpeed / (1024 * 1024)).toFixed(2)} MB/s`,
            peers: torrent.numPeers,
          });
        }, 250);
      });
      torrent.on("done", () => {
        if (this.interval) clearInterval(this.interval);
        this.emit("done");
        this.client.destroy((err) => {
          if (err) {
            reject(err);
          } else {
            resolve(null);
          }
        });
      });
      torrent.on("error", (err) => {
        if (this.interval) clearInterval(this.interval);
        this.client.destroy(() => reject(err));
      });
    });
  }
}
