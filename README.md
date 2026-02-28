# Torrent Streamer

A self-hosted movie streaming app that downloads torrents on-demand and plays them in the browser. Built with React, Hono, WebTorrent, and Sequelize.

Movies are fetched from the YTS catalog, ranked by TMDb popularity, and searchable through an infinite-scroll UI. When you click a movie, the server downloads the torrent in real-time via Server-Sent Events, caches it for 24 hours, and serves the video with subtitle support and HTTP range seeking.

## Prerequisites

- Node.js 20+
- A [NordVPN](https://nordvpn.com) subscription (for the SOCKS5 proxy)
- A [TMDb](https://www.themoviedb.org) account (optional, for popularity ranking)

## Setup

```shell
cp .env.example .env.local
npm install
```

Edit `.env.local` with your values:

```env
PORT=3900
APP_URL=http://localhost:8900
DATABASE_DIALECT=sqlite3
DATABASE_URL=sqlite3:database.sqlite
BASE_PATH=/
PROXY_HOST=amsterdam.nl.socks.nordhold.net
PROXY_PORT=1080
PROXY_USERNAME=your-nordvpn-username
PROXY_PASSWORD=your-nordvpn-password
```

### NordVPN SOCKS5 Proxy

All outbound requests to YTS are routed through a SOCKS5 proxy to bypass regional restrictions. NordVPN provides SOCKS5 servers for this purpose.

1. Log in to [my.nordaccount.com](https://my.nordaccount.com) and go to **Services** > **NordVPN**.
2. Under **Manual setup**, copy your service credentials (username and password). These are different from your NordVPN login credentials.
3. Choose a server hostname from [NordVPN's server list](https://nordvpn.com/servers/tools/). The hostname format is `hostname.nordhold.net` and the port is `1080`.
4. Set `PROXY_HOST`, `PROXY_PORT`, `PROXY_USERNAME`, and `PROXY_PASSWORD` in `.env.local`.

### TMDb Popularity Data

The app downloads a daily export from TMDb to rank movies by popularity. This works without an API key — the export is a public gzipped file. No TMDb configuration is needed. If the export is unavailable, movies fall back to a popularity of 0 and are sorted by rating instead.

## Development

```shell
npm start
```

This starts the Vite dev server (client) and tsx watch (server) concurrently. The client runs at `localhost:8900` and the server at `localhost:3900`.

## CLI

```shell
# Manually refresh the movie catalog from YTS
npm run cli -- update-streams

# Download a specific torrent by hash
npm run cli -- download-torrent <hash>

# Remove expired cached downloads
npm run cli -- cleanup-cache
```

## Cron Jobs

These run automatically when the server is running:

- **Every 6 hours** — Refreshes the movie catalog from YTS and updates torrent availability.
- **Every hour** — Deletes cached downloads older than 24 hours and removes their files from disk.

## Production

```shell
npm run build
pm2 start --name app build/server/index.js
```

Example NGINX config:

```nginx
server {
    server_name _;
    listen 80;
    listen [::]:80;
    client_max_body_size 500m;

    index index.html;
    root /var/www/torrents/build/client;

    location / {
        try_files $uri $uri/ /index.html =404;
    }

    location /api {
        proxy_redirect off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_pass http://localhost:3900;
    }
}
```

## Environment Variables

[Dotenvx](https://dotenvx.com/docs) is used for storing encrypted environment variables in version control. Config files are loaded in this order (later values override earlier ones):

1. `.env.dev` or `.env.prod` (encrypted, committed)
2. `.env.local` (local overrides, gitignored)
3. Process environment variables

Encrypt/decrypt commands:

```shell
npm run env:encrypt:dev
npm run env:decrypt:dev
npm run env:encrypt:prod
npm run env:decrypt:prod
```

Keep `.env.keys` out of version control.

## Testing

```shell
npm run test        # Run all tests
npm run check       # TypeScript type check
```

## Database

SQLite is the default. To use MySQL instead, update your `.env.local`:

```env
DATABASE_DIALECT=mysql
DATABASE_URL=mysql://root:secret@127.0.0.1:3306/torrents
```
