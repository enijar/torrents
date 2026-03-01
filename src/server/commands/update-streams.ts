import { fetch as undiciFetch } from "undici";
import { z } from "zod/v4";
import { Op } from "@sequelize/core";
import agent from "server/services/agent.js";
import config from "config/index.js";
import Stream from "server/models/stream.js";
import {
  downloadTMDbExport,
  findMovieInExport,
} from "server/services/tmdb-export.js";

const TorrentSchema = z.object({
  hash: z.string(),
  quality: z.string(),
  video_codec: z.string().optional(),
  size_bytes: z.number(),
  seeds: z.number(),
});

const MovieSchema = z.object({
  id: z.number(),
  title: z.string(),
  year: z.number(),
  rating: z.number(),
  runtime: z.number(),
  genres: z.array(z.string()).optional(),
  synopsis: z.string().optional(),
  yt_trailer_code: z.string().optional(),
  imdb_code: z.string().optional(),
  large_cover_image: z.string().optional(),
  torrents: z.array(TorrentSchema),
});

const APIResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    movie_count: z.number(),
    limit: z.number(),
    page_number: z.number(),
    movies: z.array(MovieSchema).optional(),
  }),
});

const YTS_BASE = "https://yts.bz/api/v2/list_movies.json";
const PER_PAGE = 50;
const BATCH_SIZE = 10;

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function fetchPage(page: number): Promise<z.infer<typeof APIResponseSchema> | null> {
  const url = `${YTS_BASE}?limit=${PER_PAGE}&page=${page}&sort_by=year&order_by=desc`;
  try {
    const res = await undiciFetch(url, { dispatcher: agent });
    if (!res.ok) {
      console.warn(`[update-streams] Page ${page} returned ${res.status}`);
      return null;
    }
    const json = await res.json();
    return APIResponseSchema.parse(json);
  } catch (err) {
    console.warn(`[update-streams] Page ${page} failed:`, err);
    return null;
  }
}

export default async function updateStreams(): Promise<void> {
  console.log("[update-streams] Starting...");

  const tmdbMap = await downloadTMDbExport();

  // Fetch first page to get total count
  const first = await fetchPage(1);
  if (!first || first.status !== "ok") {
    console.error("[update-streams] Failed to fetch first page, aborting");
    return;
  }

  const totalMovies = first.data.movie_count;
  const totalPages = Math.ceil(totalMovies / PER_PAGE);
  console.log(
    `[update-streams] ${totalMovies} movies, ${totalPages} pages to fetch`,
  );

  let upserted = 0;

  // Process first page
  if (first.data.movies) {
    upserted += await processMovies(first.data.movies, tmdbMap);
  }

  // Process remaining pages in batches
  const remainingPages = Array.from(
    { length: totalPages - 1 },
    (_, i) => i + 2,
  );
  const batches = chunk(remainingPages, BATCH_SIZE);

  for (const batch of batches) {
    const results = await Promise.all(batch.map(fetchPage));
    for (const result of results) {
      if (result?.data.movies) {
        upserted += await processMovies(result.data.movies, tmdbMap);
      }
    }
    console.log(
      `[update-streams] Progress: pages ${batch[0]}-${batch[batch.length - 1]} of ${totalPages} (${upserted} upserted)`,
    );
  }

  console.log(`[update-streams] Done. ${upserted} streams upserted.`);

  await resolvePosters();
}

const POSTER_BATCH_SIZE = 40;
const POSTER_RATE_WINDOW_MS = 10_000;

async function resolvePosters(): Promise<void> {
  const streams = await Stream.findAll({
    where: {
      posterUrl: { [Op.is]: null },
      imdbCode: { [Op.not]: null },
    },
    attributes: ["uuid", "imdbCode"],
  });

  if (streams.length === 0) {
    console.log("[update-streams] All streams already have poster URLs.");
    return;
  }

  console.log(
    `[update-streams] Resolving posters for ${streams.length} streams...`,
  );

  const batches = chunk(streams, POSTER_BATCH_SIZE);
  let resolved = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchStart = Date.now();

    await Promise.all(
      batch.map(async (stream) => {
        try {
          const res = await fetch(
            `https://api.themoviedb.org/3/find/${stream.imdbCode}?external_source=imdb_id`,
            {
              headers: {
                Authorization: `Bearer ${config.TMDB_API_KEY}`,
              },
            },
          );
          if (!res.ok) return;
          const data = await res.json();
          const backdropPath = data?.movie_results?.[0]?.poster_path;
          if (backdropPath) {
            await Stream.update(
              { posterUrl: `https://image.tmdb.org/t/p/w500${backdropPath}` },
              { where: { uuid: stream.uuid } },
            );
            resolved++;
          }
        } catch {
          // skip failed lookups; will retry next run
        }
      }),
    );

    console.log(
      `[update-streams] Posters: batch ${i + 1}/${batches.length} done (${resolved} resolved)`,
    );

    if (i < batches.length - 1) {
      const elapsed = Date.now() - batchStart;
      const remaining = POSTER_RATE_WINDOW_MS - elapsed;
      if (remaining > 0) {
        await new Promise((r) => setTimeout(r, remaining));
      }
    }
  }

  console.log(`[update-streams] Poster resolution complete. ${resolved} resolved.`);
}

async function processMovies(
  movies: z.infer<typeof MovieSchema>[],
  tmdbMap: Awaited<ReturnType<typeof downloadTMDbExport>>,
): Promise<number> {
  let count = 0;
  for (const movie of movies) {
    const tmdb = findMovieInExport(tmdbMap, movie.title);
    const maxSeeds = Math.max(0, ...movie.torrents.map((t) => t.seeds));

    await Stream.upsert({
      apiId: movie.id,
      popularity: tmdb?.popularity ?? 0,
      title: movie.title,
      year: movie.year,
      rating: movie.rating,
      duration: movie.runtime,
      genres: movie.genres ?? [],
      synopsis: movie.synopsis ?? null,
      youTubeTrailerCode: movie.yt_trailer_code ?? null,
      imdbCode: movie.imdb_code ?? null,
      largeCoverImage: movie.large_cover_image ?? null,
      torrents: movie.torrents.map((t) => ({
        hash: t.hash,
        quality: t.quality,
        videoCodec: t.video_codec ?? "x264",
        size: t.size_bytes,
        seeds: t.seeds,
      })),
      seeds: maxSeeds,
    });
    count++;
  }
  return count;
}
