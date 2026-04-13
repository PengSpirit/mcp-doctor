import { describe, it, expect } from "vitest";
import { computePercentile } from "./bench.js";

describe("computePercentile", () => {
  it("computes p50 of sorted array", () => {
    expect(computePercentile([10, 20, 30, 40, 50], 50)).toBe(30);
  });

  it("computes p95 of larger array", () => {
    const arr = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(computePercentile(arr, 95)).toBe(95);
  });

  it("returns single value for single-element array", () => {
    expect(computePercentile([42], 50)).toBe(42);
  });

  it("computes p99", () => {
    const arr = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(computePercentile(arr, 99)).toBe(99);
  });

  it("returns 0 for empty array", () => {
    expect(computePercentile([], 50)).toBe(0);
  });
});
