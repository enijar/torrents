import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { text } from "node:stream/consumers";

interface TMDbEntry {
  id: number;
  popularity: number;
}

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
