import {
  DEFAULT_CELL_OPTIONS,
  cellFieldRegion,
  clusterLevels,
  coveredFraction,
  darkRatio,
  detectCells,
  findHorizontalSegments,
  findVerticalSegments,
  overlapFraction,
  toGray,
  type GrayImage,
} from "./detect-cells";

const opts = DEFAULT_CELL_OPTIONS;

interface Canvas {
  data: Uint8ClampedArray;
  w: number;
  h: number;
}

function blank(w: number, h: number): Canvas {
  const data = new Uint8ClampedArray(w * h * 4);
  data.fill(255);
  return { data, w, h };
}

function setDark(c: Canvas, x: number, y: number) {
  const i = (y * c.w + x) * 4;
  c.data[i] = 0;
  c.data[i + 1] = 0;
  c.data[i + 2] = 0;
  c.data[i + 3] = 255;
}

function hline(c: Canvas, y: number, x0: number, x1: number, t = 2) {
  for (let yy = y; yy < y + t; yy++) for (let x = x0; x <= x1; x++) setDark(c, x, yy);
}

function vline(c: Canvas, x: number, y0: number, y1: number, t = 2) {
  for (let xx = x; xx < x + t; xx++) for (let y = y0; y <= y1; y++) setDark(c, xx, y);
}

function gridImage(): GrayImage {
  // A 2x2 grid: 3 horizontal rules and 3 vertical rules spanning 10..90.
  const c = blank(100, 100);
  for (const y of [10, 50, 90]) hline(c, y, 10, 90);
  for (const x of [10, 50, 90]) vline(c, x, 10, 90);
  return toGray(c.data, c.w, c.h);
}

describe("toGray", () => {
  it("maps white to 255 and black to 0", () => {
    const c = blank(2, 1);
    setDark(c, 0, 0);
    const img = toGray(c.data, 2, 1);
    expect(img.gray[0]).toBe(0);
    expect(img.gray[1]).toBe(255);
  });
});

describe("line detection", () => {
  it("finds the horizontal rules", () => {
    const levels = clusterLevels(findHorizontalSegments(gridImage(), opts), opts);
    expect(levels.map((l) => Math.round(l.pos))).toEqual([11, 51, 91]);
  });

  it("finds the vertical rules", () => {
    const levels = clusterLevels(findVerticalSegments(gridImage(), opts), opts);
    expect(levels.map((l) => Math.round(l.pos))).toEqual([11, 51, 91]);
  });

  it("ignores short strokes below the minimum length", () => {
    const c = blank(100, 100);
    hline(c, 20, 10, 20); // only 11px long
    const segs = findHorizontalSegments(toGray(c.data, 100, 100), opts);
    expect(segs).toHaveLength(0);
  });

  it("rejects the interior of a thick solid fill but keeps its edges", () => {
    const c = blank(100, 40);
    for (let y = 10; y < 30; y++) hline(c, y, 5, 95, 1); // 20px-thick bar
    const levels = clusterLevels(findHorizontalSegments(toGray(c.data, 100, 40), opts), opts);
    // Only the top and bottom edges survive the thinness test, not every interior row.
    expect(levels.length).toBeLessThanOrEqual(2);
  });
});

describe("detectCells", () => {
  it("reconstructs the four cells of a 2x2 grid", () => {
    const img = gridImage();
    const h = clusterLevels(findHorizontalSegments(img, opts), opts);
    const v = clusterLevels(findVerticalSegments(img, opts), opts);
    const cells = detectCells(h, v, opts);
    expect(cells).toHaveLength(4);
    const first = cells.find((c) => c.x < 30 && c.y < 30)!;
    expect(first.width).toBeCloseTo(40, 0);
    expect(first.height).toBeCloseTo(40, 0);
  });

  it("merges a cell when an internal boundary is missing", () => {
    // Same grid but no middle vertical: top row becomes one wide cell.
    const c = blank(100, 100);
    for (const y of [10, 50, 90]) hline(c, y, 10, 90);
    for (const x of [10, 90]) vline(c, x, 10, 90);
    const img = toGray(c.data, 100, 100);
    const h = clusterLevels(findHorizontalSegments(img, opts), opts);
    const v = clusterLevels(findVerticalSegments(img, opts), opts);
    const cells = detectCells(h, v, opts);
    expect(cells).toHaveLength(2);
    expect(cells[0].width).toBeCloseTo(80, 0);
  });
});

describe("coveredFraction", () => {
  it("measures how much of a span the intervals cover", () => {
    expect(coveredFraction([{ start: 0, end: 50 }], 0, 100)).toBeCloseTo(0.5, 6);
    expect(coveredFraction([{ start: -10, end: 200 }], 0, 100)).toBeCloseTo(1, 6);
  });
});

describe("darkRatio", () => {
  it("is high for a filled rect and low for blank paper", () => {
    const c = blank(30, 30);
    for (let y = 0; y < 30; y++) hline(c, y, 0, 29, 1);
    const dark = toGray(c.data, 30, 30);
    expect(darkRatio(dark, { x: 0, y: 0, width: 30, height: 30 }, opts.dark)).toBeGreaterThan(0.9);
    expect(darkRatio(toGray(blank(30, 30).data, 30, 30), { x: 0, y: 0, width: 30, height: 30 }, opts.dark)).toBe(0);
  });
});

describe("overlapFraction", () => {
  it("is 1 for identical rects and 0 for disjoint ones", () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    expect(overlapFraction(a, a)).toBe(1);
    expect(overlapFraction(a, { x: 20, y: 20, width: 10, height: 10 })).toBe(0);
  });
});

describe("cellFieldRegion", () => {
  it("fills an empty cell up to the single-line cap, anchored to the bottom", () => {
    const region = cellFieldRegion({ x: 0, y: 0, width: 100, height: 30 }, [], 0, opts)!;
    expect(region.x).toBe(opts.pad);
    expect(region.width).toBe(100 - 2 * opts.pad);
    expect(region.height).toBeLessThanOrEqual(opts.maxFieldH);
    // Bottom-anchored: its lower edge sits on the cell's bottom inset.
    expect(region.y + region.height).toBeCloseTo(30 - opts.pad, 0);
  });

  it("returns the space below a top-corner label, anchored to the bottom rule", () => {
    const cell = { x: 0, y: 0, width: 200, height: 60 };
    const label = { x: 2, y: 2, width: 40, height: 10 };
    const region = cellFieldRegion(cell, [label], 0, opts)!;
    expect(region.height).toBeGreaterThanOrEqual(opts.minFieldH);
    expect(region.height).toBeLessThanOrEqual(opts.maxFieldH);
    expect(region.y + region.height).toBeCloseTo(60 - opts.pad, 0);
    expect(region.y).toBeGreaterThan(12);
  });

  it("falls back to the space right of a label when there is no room below", () => {
    const cell = { x: 0, y: 0, width: 200, height: 24 };
    const label = { x: 0, y: 2, width: 40, height: 12 };
    const region = cellFieldRegion(cell, [label], 0, opts)!;
    expect(region.x).toBeCloseTo(42, 0);
    expect(region.width).toBeGreaterThan(opts.minFieldW);
  });

  it("skips a solid header bar", () => {
    expect(cellFieldRegion({ x: 0, y: 0, width: 300, height: 20 }, [], 0.9, opts)).toBeNull();
  });

  it("skips a cell that is full of text with no empty room", () => {
    const cell = { x: 0, y: 0, width: 60, height: 20 };
    const label = { x: 1, y: 1, width: 58, height: 18 };
    expect(cellFieldRegion(cell, [label], 0, opts)).toBeNull();
  });
});
