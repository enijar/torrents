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

interface TMDbFindResult {
  tmdbId: number | null;
  posterUrl: string | null;
  popularity: number;
}

/**
 * Look up a movie on TMDb by its IMDb ID. Returns tmdbId, poster URL,
 * and popularity in a single API call.
 */
async function findByImdbId(imdbCode: string): Promise<TMDbFindResult | null> {
  const url = `https://api.themoviedb.org/3/find/${imdbCode}?api_key=${config.TMDB_API_KEY}&external_source=imdb_id`;
  const res = await fetch(url);
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("retry-after") ?? "2", 10);
    await sleep(retryAfter * 1000);
    const retry = await fetch(url);
    if (!retry.ok) return null;
    const data = await retry.json();
    const movie = data.movie_results?.[0];
    if (!movie) return null;
    return {
      tmdbId: movie.id ?? null,
      posterUrl: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : null,
      popularity: movie.popularity ?? 0,
    };
  }
  if (!res.ok) return null;
  const data = await res.json();
  const movie = data.movie_results?.[0];
  if (!movie) return null;
  return {
    tmdbId: movie.id ?? null,
    posterUrl: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : null,
    popularity: movie.popularity ?? 0,
  };
}

interface PosterItem {
  uuid: string;
  imdbCode: string;
}

interface PosterResult {
  uuid: string;
  tmdbId: number | null;
  posterUrl: string | null;
  popularity: number;
}

/**
 * Fetch TMDb data for a batch of streams using their IMDb codes.
 * TMDb allows ~50 req/s. We send 40 concurrent requests then
 * sleep 1s to stay safely under the limit (~40 req/s).
 */
export async function fetchTMDbDataInBatches(
  items: PosterItem[],
  onResult: (result: PosterResult) => Promise<void>,
): Promise<number> {
  const BATCH_SIZE = 40;
  let fetched = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (item) => {
        const found = await findByImdbId(item.imdbCode);
        return { uuid: item.uuid, found };
      }),
    );

    for (const { uuid, found } of results) {
      if (found) {
        await onResult({
          uuid,
          tmdbId: found.tmdbId,
          posterUrl: found.posterUrl,
          popularity: found.popularity,
        });
        if (found.posterUrl) fetched++;
      }
    }

    const processed = Math.min(i + BATCH_SIZE, items.length);
    if (processed % 2000 < BATCH_SIZE) {
      console.log(
        `[tmdb-posters] Progress: ${processed}/${items.length} (${fetched} posters found)`,
      );
    }

    if (i + BATCH_SIZE < items.length) {
      await sleep(1_000);
    }
  }

  console.log(
    `[tmdb-posters] Done: ${items.length}/${items.length} (${fetched} posters found)`,
  );
  return fetched;
}
