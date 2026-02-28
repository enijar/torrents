import TorrentService from "server/services/torrent-service.js";

export default async function downloadTorrent(hash?: string) {
  if (!hash) {
    console.error("Usage: download-torrent <hash>");
    process.exit(1);
  }
  const torrentService = new TorrentService();
  torrentService.on<{ name: string; files: { name: string; path: string }[] }>("metadata", (info) => {
    console.log("[metadata]", info)
  });
  torrentService.on<{ progress: number; speed: string; peers: number }>("progress", (info) => {
    console.log("[progress]", info);
  });
  await torrentService.download(hash);
  console.log("\nDownload complete!");
}
