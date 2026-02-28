import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Watch from "client/pages/watch/watch.js";
import { MockEventSource } from "../../setup.js";

beforeEach(() => {
  MockEventSource.instances = [];
});

function renderWatch(hash = "abc123") {
  return render(
    <MemoryRouter initialEntries={[`/watch/${hash}`]}>
      <Routes>
        <Route path="/watch/:hash" element={<Watch />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Watch page", () => {
  it("shows torrent name and file list after metadata event", async () => {
    renderWatch();

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    const es = MockEventSource.instances[0];
    expect(es.url).toBe("/api/watch/abc123");

    act(() => {
      es.__emit("metadata", {
        name: "Test Movie",
        files: [
          { name: "movie.mp4", path: "Test Movie/movie.mp4" },
          { name: "subs.srt", path: "Test Movie/subs.srt" },
        ],
      });
    });

    expect(screen.getByText("Downloading: Test Movie")).toBeInTheDocument();
    expect(screen.getByText("movie.mp4")).toBeInTheDocument();
    expect(screen.getByText("subs.srt")).toBeInTheDocument();
  });

  it("shows download progress percentage", async () => {
    renderWatch();

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    act(() => {
      MockEventSource.instances[0].__emit("progress", {
        progress: 42,
        speed: "2.50 MB/s",
        peers: 10,
      });
    });

    expect(screen.getByText(/42%/)).toBeInTheDocument();
  });

  it("shows video player with subtitles after done event", async () => {
    renderWatch();

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    const es = MockEventSource.instances[0];

    act(() => {
      es.__emit("metadata", {
        name: "Test Movie",
        files: [{ name: "movie.mp4", path: "Test Movie/movie.mp4" }],
      });
      es.__emit("done", {
        videoUrl: "/api/files/Test%20Movie/movie.mp4",
        subtitleUrl: "/api/files/Test%20Movie/subs.vtt",
      });
    });

    const video = document.querySelector("video");
    expect(video).toBeTruthy();
    expect(video?.getAttribute("autoplay")).not.toBeNull();

    const source = video?.querySelector("source");
    expect(source?.getAttribute("src")).toBe("/api/files/Test%20Movie/movie.mp4");

    const track = video?.querySelector("track");
    expect(track?.getAttribute("kind")).toBe("subtitles");
    expect(track?.getAttribute("srclang")).toBe("en");
    expect(track?.getAttribute("src")).toBe("/api/files/Test%20Movie/subs.vtt");
  });
});
