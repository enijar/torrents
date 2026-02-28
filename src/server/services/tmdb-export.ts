import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { text } from "node:stream/consumers";
import config from "config/index.js";

interface TMDbEntry {
  id: number;
  popularity: number;
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

type TMDbMap = Map<string, TMDbEntry>;

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function getTodayDateString(): string {
  const d = new Date();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${mm}_${dd}_${yyyy}`;
}

export async function downloadTMDbExport(): Promise<TMDbMap> {
  const dateStr = getTodayDateString();
  const url = `http://files.tmdb.org/p/exports/movie_ids_${dateStr}.json.gz`;

  console.log(`[tmdb-export] Downloading ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    console.warn(
      `[tmdb-export] Failed to fetch (${res.status}), returning empty map`,
    );
    return new Map();
  }

  const gunzip = createGunzip();
  Readable.fromWeb(res.body as any).pipe(gunzip);
  const raw = await text(gunzip);

  const map: TMDbMap = new Map();
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.original_title) {
        map.set(normalizeTitle(entry.original_title), {
          id: entry.id,
          popularity: entry.popularity ?? 0,
        });
      }
    } catch {
      // skip malformed lines
    }
  }

  console.log(`[tmdb-export] Loaded ${map.size} entries`);
  return map;
}

export function findMovieInExport(
  tmdbMap: TMDbMap,
  title: string,
): TMDbEntry | undefined {
  return tmdbMap.get(normalizeTitle(title));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchTMDbPoster(
  tmdbId: number,
): Promise<string | null> {
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${config.TMDB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.poster_path) {
    return `${TMDB_IMAGE_BASE}${data.poster_path}`;
  }
  return null;
}

/**
 * Fetch TMDb posters for a batch of {tmdbId, uuid} pairs.
 * Rate-limited to 35 requests per 10 seconds to stay under TMDb's ~40 req/10s limit.
 */
export async function fetchPostersInBatches(
  items: { tmdbId: number; uuid: string }[],
  onResult: (uuid: string, posterUrl: string) => Promise<void>,
): Promise<number> {
  const BATCH_SIZE = 35;
  let fetched = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (item) => {
        const poster = await fetchTMDbPoster(item.tmdbId);
        return { uuid: item.uuid, poster };
      }),
    );

    for (const { uuid, poster } of results) {
      if (poster) {
        await onResult(uuid, poster);
        fetched++;
      }
    }

    console.log(
      `[tmdb-posters] Progress: ${Math.min(i + BATCH_SIZE, items.length)}/${items.length} (${fetched} posters found)`,
    );

    // Wait 10s between batches to respect rate limit
    if (i + BATCH_SIZE < items.length) {
      await sleep(10_000);
    }
  }

  return fetched;
}
