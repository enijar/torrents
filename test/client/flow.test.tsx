import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import Home from "client/pages/home/home.js";
import Watch from "client/pages/watch/watch.js";
import { MockEventSource } from "../setup.js";

const mockStreams = [
  {
    uuid: "flow-1",
    title: "Flow Test Movie",
    year: 2024,
    rating: 8.0,
    largeCoverImage: "https://yts.bz/assets/images/movies/flow.jpg",
    posterImage: null,
    torrents: [
      { hash: "low-quality", quality: "720p", videoCodec: "x264", size: 1000, seeds: 50 },
      { hash: "best-quality", quality: "1080p", videoCodec: "x264", size: 2000, seeds: 30 },
    ],
  },
];

beforeEach(() => {
  MockEventSource.instances = [];
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

describe("Full flow: Home → Watch", () => {
  it("navigates from movie list to video player with subtitles", async () => {
    const user = userEvent.setup();

    const router = createMemoryRouter(
      [
        { path: "/", element: <Home /> },
        { path: "/watch/:hash", element: <Watch /> },
      ],
      { initialEntries: ["/"] },
    );

    render(<RouterProvider router={router} />);

    // Home page renders movies
    await waitFor(() => {
      expect(screen.getByText("Flow Test Movie")).toBeInTheDocument();
    });

    // Movie card should link to best quality hash (1080p → best-quality)
    const link = screen.getByText("Flow Test Movie").closest("a");
    expect(link).toHaveAttribute("href", "/watch/best-quality");

    // Click the movie card
    await user.click(screen.getByText("Flow Test Movie"));

    // Should navigate to watch page
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/watch/best-quality");
    });

    // EventSource should connect
    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });
    const es = MockEventSource.instances[0];
    expect(es.url).toBe("/api/watch/best-quality");

    // SSE: metadata
    act(() => {
      es.__emit("metadata", {
        name: "Flow Test Movie",
        files: [
          { name: "movie.mp4", path: "Flow Test Movie/movie.mp4" },
          { name: "english.srt", path: "Flow Test Movie/english.srt" },
        ],
      });
    });
    expect(screen.getByText("Downloading: Flow Test Movie")).toBeInTheDocument();

    // SSE: progress
    act(() => {
      es.__emit("progress", { progress: 75, speed: "3.00 MB/s", peers: 12 });
    });
    expect(screen.getByText(/75%/)).toBeInTheDocument();

    // SSE: done
    act(() => {
      es.__emit("done", {
        videoUrl: "/api/files/Flow%20Test%20Movie/movie.mp4",
        subtitleUrl: "/api/files/Flow%20Test%20Movie/english.srt",
      });
    });

    // Video player should appear
    const video = document.querySelector("video");
    expect(video).toBeTruthy();

    const source = video?.querySelector("source");
    expect(source?.getAttribute("src")).toBe("/api/files/Flow%20Test%20Movie/movie.mp4");

    const track = video?.querySelector("track");
    expect(track?.getAttribute("kind")).toBe("subtitles");
    expect(track?.getAttribute("srclang")).toBe("en");
    expect(track?.getAttribute("src")).toBe("/api/files/Flow%20Test%20Movie/english.srt");
  });
});
