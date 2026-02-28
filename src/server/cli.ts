import downloadTorrent from "server/commands/download-torrent.js";

const commands = {
  "download-torrent": downloadTorrent,
};

const command = process.argv[2] as keyof typeof commands;

try {
  const exec = commands[command];
  if (!exec) {
    console.error("Command not found");
    process.exit(1);
  }
  await exec();
  process.exit(0);
} catch (err) {
  console.log(err);
  process.exit(1);
}
