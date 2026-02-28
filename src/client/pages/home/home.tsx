import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import * as Style from "client/pages/home/home.style.js";

interface Torrent {
  hash: string;
  quality: string;
  videoCodec: string;
  size: number;
  seeds: number;
}

interface Stream {
  uuid: string;
  title: string;
  year: number;
  rating: number;
  largeCoverImage: string;
  torrents: Torrent[];
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function Stars({ rating }: { rating: number }) {
  const stars = Math.round(rating) / 2;
  const full = Math.floor(stars);
  const empty = 5 - full;
  return (
    <>
      {"★".repeat(full)}
      {"☆".repeat(empty)}
    </>
  );
}

const QUALITY_RANK: Record<string, number> = {
  "2160p": 4,
  "1080p": 3,
  "720p": 2,
  "480p": 1,
  "3D": 0,
};

function bestTorrentHash(torrents: Torrent[]): string | undefined {
  if (torrents.length === 0) return undefined;
  const playable = torrents.filter((t) => t.videoCodec !== "x265");
  const pool = playable.length > 0 ? playable : torrents;
  return pool.reduce((best, t) =>
    (QUALITY_RANK[t.quality] ?? -1) > (QUALITY_RANK[best.quality] ?? -1) ? t : best
  ).hash;
}

function posterSrc(largeCoverImage: string): string {
  try {
    const { pathname } = new URL(largeCoverImage);
    return `/api/yts-proxy${pathname}`;
  } catch {
    return largeCoverImage;
  }
}

export default function Home() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 100);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [offset, setOffset] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [selectedGenre, setSelectedGenre] = useState("");
  const genreBarRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollArrows = useCallback(() => {
    const el = genreBarRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  const scrollGenres = useCallback((direction: "left" | "right") => {
    const el = genreBarRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -el.clientWidth : el.clientWidth });
  }, []);

  useEffect(() => {
    fetch("/api/genres")
      .then((res) => res.json())
      .then((data) => setGenres(data.genres))
      .catch(() => {});
  }, []);

  useEffect(() => {
    updateScrollArrows();
  }, [genres, updateScrollArrows]);

  const fetchStreams = useCallback(
    async (currentOffset: number, replace: boolean) => {
      if (replace) {
        abortRef.current?.abort();
        abortRef.current = new AbortController();
      }
      const signal = abortRef.current?.signal;
      setLoading(true);
      try {
        const params = new URLSearchParams({ offset: String(currentOffset) });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (selectedGenre) params.set("genre", selectedGenre);
        const res = await fetch(`/api/streams?${params}`, { signal });
        const data = await res.json();
        setStreams((prev) => (replace ? data.streams : [...prev, ...data.streams]));
        setOffset(data.offset);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, selectedGenre],
  );

  useEffect(() => {
    setOffset(0);
    fetchStreams(0, true);
  }, [debouncedSearch, selectedGenre]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && offset !== null && !loading) {
          fetchStreams(offset, false);
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [offset, loading, fetchStreams]);

  return (
    <Style.Wrapper>
      <Style.SearchWrapper>
        <Style.SearchBar
          type="text"
          placeholder="Search movies..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            window.scrollTo(0, 0);
          }}
        />
        <Style.GenreBarWrapper>
          {canScrollLeft && (
            <Style.ScrollArrow onClick={() => scrollGenres("left")}>&#8249;</Style.ScrollArrow>
          )}
          <Style.GenreBar ref={genreBarRef} onScroll={updateScrollArrows}>
            <Style.GenreChip
              $active={selectedGenre === ""}
              onClick={() => {
                setSelectedGenre("");
                window.scrollTo(0, 0);
              }}
            >
              All
            </Style.GenreChip>
            {genres.map((genre) => (
              <Style.GenreChip
                key={genre}
                $active={selectedGenre === genre}
                onClick={() => {
                  setSelectedGenre((prev) => (prev === genre ? "" : genre));
                  window.scrollTo(0, 0);
                }}
              >
                {genre}
              </Style.GenreChip>
            ))}
          </Style.GenreBar>
          {canScrollRight && (
            <Style.ScrollArrow onClick={() => scrollGenres("right")}>&#8250;</Style.ScrollArrow>
          )}
        </Style.GenreBarWrapper>
      </Style.SearchWrapper>
      <Style.Grid>
        {streams.map((stream, index) => (
          <Style.Card key={index}>
            <Link to={`/watch/${bestTorrentHash(stream.torrents)}`}>
              <Style.Poster src={posterSrc(stream.largeCoverImage)} alt={stream.title} loading="lazy" />
              <Style.CardInfo>
                <Style.Rating>
                  <Stars rating={stream.rating} />
                  <span>{stream.year}</span>
                </Style.Rating>
                <Style.Title>{stream.title}</Style.Title>
              </Style.CardInfo>
            </Link>
          </Style.Card>
        ))}
      </Style.Grid>
      <div ref={sentinelRef} />
      {loading && <Style.LoadingText>Loading...</Style.LoadingText>}
    </Style.Wrapper>
  );
}
