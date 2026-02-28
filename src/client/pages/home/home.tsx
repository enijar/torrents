import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import * as Style from "client/pages/home/home.style.js";

interface Torrent {
  hash: string;
  quality: string;
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
  const debouncedSearch = useDebounce(search, 300);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [offset, setOffset] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchStreams = useCallback(
    async (currentOffset: number, replace: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ offset: String(currentOffset) });
        if (debouncedSearch) params.set("search", debouncedSearch);
        const res = await fetch(`/api/streams?${params}`);
        const data = await res.json();
        setStreams((prev) => (replace ? data.streams : [...prev, ...data.streams]));
        setOffset(data.offset);
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch],
  );

  useEffect(() => {
    setStreams([]);
    setOffset(0);
    fetchStreams(0, true);
  }, [debouncedSearch]);

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
      <Style.SearchBar
        type="text"
        placeholder="Search movies..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Style.Grid>
        {streams.map((stream) => (
          <Style.Card key={stream.uuid}>
            <Link to={`/watch/${stream.torrents[0]?.hash}`}>
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
