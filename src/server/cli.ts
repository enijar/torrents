import database from "server/services/database.js";
import downloadTorrent from "server/commands/download-torrent.js";
import updateStreams from "server/commands/update-streams.js";

const commands = {
  "download-torrent": downloadTorrent,
  "update-streams": updateStreams,
};

const command = process.argv[2] as keyof typeof commands;

try {
  const exec = commands[command];
  if (!exec) {
    console.error("Command not found");
    process.exit(1);
  }
  await database.sync({ alter: true });
  const args = process.argv.slice(3);
  await exec(...args);
  process.exit(0);
} catch (err) {
  console.log(err);
  process.exit(1);
}
