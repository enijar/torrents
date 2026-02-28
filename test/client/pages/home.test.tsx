import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "client/pages/home/home.js";

afterEach(cleanup);

const mockStreams = [
  {
    uuid: "1",
    title: "Test Movie",
    year: 2024,
    rating: 8.0,
    largeCoverImage: "https://yts.bz/assets/images/movies/test.jpg",
    torrents: [
      { hash: "low-hash", quality: "720p", size: 1000, seeds: 50 },
      { hash: "high-hash", quality: "1080p", size: 2000, seeds: 30 },
    ],
  },
  {
    uuid: "2",
    title: "Another Movie",
    year: 2023,
    rating: 6.0,
    largeCoverImage: "https://yts.bz/assets/images/movies/another.jpg",
    torrents: [
      { hash: "only-hash", quality: "480p", size: 500, seeds: 10 },
      { hash: "best-hash", quality: "2160p", size: 4000, seeds: 5 },
    ],
  },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ streams: mockStreams, offset: null }),
    }),
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});

describe("Home page", () => {
  it("renders movie cards with titles", async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Test Movie")).toBeInTheDocument();
      expect(screen.getByText("Another Movie")).toBeInTheDocument();
    });
  });

  it("links to watch page with best quality hash (not torrents[0])", async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Test Movie")).toBeInTheDocument();
    });

    // "Test Movie" has 720p (low-hash) and 1080p (high-hash) → best is high-hash
    const testLink = screen.getByText("Test Movie").closest("a");
    expect(testLink).toHaveAttribute("href", "/watch/high-hash");

    // "Another Movie" has 480p (only-hash) and 2160p (best-hash) → best is best-hash
    const anotherLink = screen.getByText("Another Movie").closest("a");
    expect(anotherLink).toHaveAttribute("href", "/watch/best-hash");
  });

  it("renders search bar", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByPlaceholderText("Search movies...")).toBeInTheDocument();
  });
});
