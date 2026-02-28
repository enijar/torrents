import { describe, it, expect, vi, beforeEach } from "vitest";

let mockEntries: { name: string; destroy: ReturnType<typeof vi.fn> }[] = [];

vi.mock("server/models/cached-stream.js", () => {
  return {
    default: {
      findAll: vi.fn(async () => mockEntries),
    },
  };
});

const mockRm = vi.fn(async () => {});
vi.mock("node:fs/promises", () => ({
  default: { rm: (...args: unknown[]) => mockRm(...args) },
}));

import cleanupCache from "server/commands/cleanup-cache.js";

describe("cleanupCache", () => {
  beforeEach(() => {
    mockEntries = [];
    mockRm.mockClear();
  });

  it("deletes expired entries and their directories", async () => {
    mockEntries = [
      { name: "Expired Movie 1", destroy: vi.fn(async () => {}) },
      { name: "Expired Movie 2", destroy: vi.fn(async () => {}) },
    ];

    await cleanupCache();

    expect(mockRm).toHaveBeenCalledTimes(2);
    expect(mockRm).toHaveBeenCalledWith(
      expect.stringContaining("Expired Movie 1"),
      { recursive: true, force: true },
    );
    expect(mockRm).toHaveBeenCalledWith(
      expect.stringContaining("Expired Movie 2"),
      { recursive: true, force: true },
    );

    expect(mockEntries[0].destroy).toHaveBeenCalled();
    expect(mockEntries[1].destroy).toHaveBeenCalled();
  });

  it("does nothing when no entries are expired", async () => {
    mockEntries = [];

    await cleanupCache();

    expect(mockRm).not.toHaveBeenCalled();
  });
});
