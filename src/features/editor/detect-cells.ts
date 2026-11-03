import type { PDFPageProxy } from "pdfjs-dist/types/src/display/api";
import { screenRectToPdf, type PageGeometry, type Rect } from "@/lib/pdf/coords";
import type { OverlayElement } from "@/schemas/overlay";
import type { DetectTextItem } from "@/features/editor/detect-fields";

/*
  Raster field detection. Government forms draw their fillable areas as cells in a
  ruled grid, but the lines are not reliably available as vector operations (on
  the Pag-IBIG form pdf.js exposes the text but almost no drawing ops). So, like
  pdffiller, this reads the pixels of the rendered page: it finds the long thin
  horizontal and vertical lines, reconstructs the grid, derives the cells, and
  drops an empty text field into each cell that has room to type in.

  The pixel math is pure and framework-free (it takes a grayscale buffer), so the
  whole pipeline is unit-testable with synthetic grids. Only the rasterizing
  orchestrator at the bottom touches pdf.js and the canvas. Cell rects are turned
  into stored PDF-point rects through coords.ts, like every other overlay.
*/

export interface Segment {
  pos: number; // the line's position on the perpendicular axis (y for horizontal)
  start: number; // extent start along the line (x for horizontal)
  end: number;
}

export interface GridLevel {
  pos: number;
  intervals: Array<{ start: number; end: number }>;
}

export interface GrayImage {
  gray: Uint8Array;
  width: number;
  height: number;
}

export interface DetectCellsOptions {
  dark: number; // luminance below this is "ink"
  minLine: number; // shortest run counted as a line (px)
  lineGap: number; // dark-run gap bridged within a line (px)
  thickness: number; // perpendicular distance checked to reject thick fills (px)
  clusterTol: number; // lines within this distance merge into one grid level (px)
  intervalGap: number; // collinear segments within this gap merge (px)
  coverage: number; // fraction of an edge that must be inked for a cell border
  minCellW: number;
  minCellH: number;
  pad: number; // inset of a field from its cell (px)
  labelGap: number; // gap left between a label and its field (px)
  minFieldW: number;
  minFieldH: number;
  maxFieldH: number; // tall cells get a single line anchored to the bottom rule
  headerDarkRatio: number; // cells darker than this are solid bars, skipped
}

export const DEFAULT_CELL_OPTIONS: DetectCellsOptions = {
  dark: 150,
  minLine: 18,
  lineGap: 3,
  thickness: 4,
  clusterTol: 4,
  intervalGap: 6,
  coverage: 0.6,
  minCellW: 18,
  minCellH: 15,
  pad: 2,
  labelGap: 2,
  minFieldW: 18,
  minFieldH: 11,
  maxFieldH: 26,
  headerDarkRatio: 0.5,
};

/** RGBA pixels -> a grayscale (0 = black, 255 = white) buffer. */
export function toGray(data: Uint8ClampedArray | Uint8Array, width: number, height: number): GrayImage {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    // Rec. 601 luma, good enough for ink-vs-paper.
    gray[i] = (r * 299 + g * 587 + b * 114) / 1000;
  }
  return { gray, width, height };
}

/*
  Generic line scan. `isDark(along, pos)` reads a pixel in line-relative axes, so
  the same run+thinness logic serves both orientations: horizontal passes pos=y
  along=x, vertical passes pos=x along=y.
*/
function scanLines(
  isDark: (along: number, pos: number) => boolean,
  alongLen: number,
  posLen: number,
  opts: DetectCellsOptions,
): Segment[] {
  const segments: Segment[] = [];
  for (let pos = 0; pos < posLen; pos++) {
    let along = 0;
    while (along < alongLen) {
      if (!isDark(along, pos)) {
        along++;
        continue;
      }
      let end = along;
      let gap = 0;
      let scan = along;
      while (scan < alongLen) {
        if (isDark(scan, pos)) {
          end = scan;
          gap = 0;
        } else if (++gap > opts.lineGap) {
          break;
        }
        scan++;
      }
      if (end - along + 1 >= opts.minLine && isLine(isDark, along, end, pos, posLen, opts.thickness)) {
        segments.push({ pos, start: along, end });
      }
      along = scan;
    }
  }
  return segments;
}

// Ink this close to a sampled row counts as "immediately adjacent" for edge
// detection, allowing a pixel of anti-aliasing at a fill's boundary.
const EDGE_TOL = 1;

/*
  Decide whether a dark run is part of a real rule rather than a solid fill. At
  each sample along the run, measure how far the ink extends perpendicular (up and
  down). A row qualifies if it is either a thin rule (small total thickness, true
  between crossings) or the exact boundary row of a filled region: paper right on
  one side and deep ink on the other. Requiring the paper side to be immediately
  adjacent is what keeps a thick section bar from registering as a whole band of
  lines (its interior rows have ink on both sides), so only its true top and
  bottom edges survive. Sampling many points means a crossing rule, thick where
  perpendicular lines pass through it, is still accepted from its clear stretches.
*/
function isLine(
  isDark: (along: number, pos: number) => boolean,
  start: number,
  end: number,
  pos: number,
  posLen: number,
  t: number,
): boolean {
  const cap = t * 2 + 4;
  const step = Math.max(1, Math.floor((end - start + 1) / 16));
  for (let a = start; a <= end; a += step) {
    let up = 0;
    while (pos - up - 1 >= 0 && up < cap && isDark(a, pos - up - 1)) up++;
    let down = 0;
    while (pos + down + 1 < posLen && down < cap && isDark(a, pos + down + 1)) down++;
    if (up + down + 1 <= t) return true; // a thin rule
    if (up <= EDGE_TOL && down >= t + 1) return true; // top edge of a fill
    if (down <= EDGE_TOL && up >= t + 1) return true; // bottom edge of a fill
  }
  return false;
}

export function findHorizontalSegments(img: GrayImage, opts: DetectCellsOptions): Segment[] {
  const { gray, width, height } = img;
  return scanLines((x, y) => gray[y * width + x] < opts.dark, width, height, opts);
}

export function findVerticalSegments(img: GrayImage, opts: DetectCellsOptions): Segment[] {
  const { gray, width, height } = img;
  return scanLines((y, x) => gray[y * width + x] < opts.dark, height, width, opts);
}

/** Merge segments into grid levels: near-equal positions grouped, collinear runs joined. */
export function clusterLevels(segments: Segment[], opts: DetectCellsOptions): GridLevel[] {
  if (segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => a.pos - b.pos);
  const levels: GridLevel[] = [];
  let group: Segment[] = [sorted[0]];
  let anchor = sorted[0].pos;
  const flush = () => {
    const pos = group.reduce((sum, s) => sum + s.pos, 0) / group.length;
    levels.push({ pos, intervals: mergeIntervals(group, opts.intervalGap) });
  };
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].pos - anchor <= opts.clusterTol) {
      group.push(sorted[i]);
      anchor = sorted[i].pos;
      continue;
    }
    flush();
    group = [sorted[i]];
    anchor = sorted[i].pos;
  }
  flush();
  return levels;
}

function mergeIntervals(segments: Segment[], gap: number): Array<{ start: number; end: number }> {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end + gap) {
      last.end = Math.max(last.end, s.end);
    } else {
      merged.push({ start: s.start, end: s.end });
    }
  }
  return merged;
}

/** Fraction of [a, b] covered by the intervals, clamped to that span. */
export function coveredFraction(intervals: Array<{ start: number; end: number }>, a: number, b: number): number {
  const span = b - a;
  if (span <= 0) return 0;
  let covered = 0;
  for (const iv of intervals) {
    const lo = Math.max(a, iv.start);
    const hi = Math.min(b, iv.end);
    if (hi > lo) covered += hi - lo;
  }
  return covered / span;
}

/** Reconstruct cell rectangles from horizontal and vertical grid levels. */
export function detectCells(
  hLevels: GridLevel[],
  vLevels: GridLevel[],
  opts: DetectCellsOptions,
): Rect[] {
  const cells: Rect[] = [];
  for (let i = 0; i < hLevels.length - 1; i++) {
    const top = hLevels[i];
    const bottom = hLevels[i + 1];
    const bandHeight = bottom.pos - top.pos;
    if (bandHeight < opts.minCellH) continue;

    // Vertical lines that span this row band become the cell boundaries.
    const boundaries = vLevels
      .filter((v) => coveredFraction(v.intervals, top.pos, bottom.pos) >= opts.coverage)
      .map((v) => v.pos)
      .sort((a, b) => a - b);

    for (let j = 0; j < boundaries.length - 1; j++) {
      const left = boundaries[j];
      const right = boundaries[j + 1];
      if (right - left < opts.minCellW) continue;
      if (coveredFraction(top.intervals, left, right) < opts.coverage) continue;
      if (coveredFraction(bottom.intervals, left, right) < opts.coverage) continue;
      cells.push({ x: left, y: top.pos, width: right - left, height: bandHeight });
    }
  }
  return cells;
}

/** Fraction of a rect's pixels that are ink (used to drop solid header bars). */
export function darkRatio(img: GrayImage, rect: Rect, dark: number): number {
  const x0 = Math.max(0, Math.round(rect.x));
  const y0 = Math.max(0, Math.round(rect.y));
  const x1 = Math.min(img.width, Math.round(rect.x + rect.width));
  const y1 = Math.min(img.height, Math.round(rect.y + rect.height));
  let total = 0;
  let inked = 0;
  // Subsample for speed; step keeps roughly 40 samples per axis.
  const stepX = Math.max(1, Math.floor((x1 - x0) / 40));
  const stepY = Math.max(1, Math.floor((y1 - y0) / 40));
  for (let y = y0; y < y1; y += stepY) {
    for (let x = x0; x < x1; x += stepX) {
      total++;
      if (img.gray[y * img.width + x] < dark) inked++;
    }
  }
  return total === 0 ? 0 : inked / total;
}

function union(boxes: Rect[]): Rect {
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function centerInside(box: Rect, cell: Rect): boolean {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return cx >= cell.x && cx <= cell.x + cell.width && cy >= cell.y && cy <= cell.y + cell.height;
}

/*
  The typable region of a cell, in pixel space (null if the cell is a solid bar or
  is full of text). The field is anchored to the bottom of the cell's usable space
  and capped to a single line (maxFieldH), so typed text sits on the cell's rule
  like a person would write it rather than floating at the top of a tall cell. An
  empty cell uses its whole interior; a cell with a corner label uses the space
  beneath the label, or, if there is no room below, the space to its right.
*/
export function cellFieldRegion(
  cell: Rect,
  textBoxes: Rect[],
  cellDarkRatio: number,
  opts: DetectCellsOptions,
): Rect | null {
  if (cellDarkRatio > opts.headerDarkRatio) return null;

  const pad = opts.pad;
  const left = cell.x + pad;
  const right = cell.x + cell.width - pad;
  const bottom = cell.y + cell.height - pad;

  const inside = textBoxes.filter((t) => centerInside(t, cell));
  const label = inside.length > 0 ? union(inside) : null;
  const top = label ? Math.max(cell.y + pad, label.y + label.height + opts.labelGap) : cell.y + pad;

  const belowHeight = bottom - top;
  if (belowHeight >= opts.minFieldH && right - left >= opts.minFieldW) {
    const height = Math.min(belowHeight, opts.maxFieldH);
    return { x: left, y: bottom - height, width: right - left, height };
  }

  if (label) {
    const rightLeft = label.x + label.width + opts.labelGap;
    const rowHeight = cell.height - 2 * pad;
    if (right - rightLeft >= opts.minFieldW && rowHeight >= opts.minFieldH) {
      const height = Math.min(rowHeight, opts.maxFieldH);
      return { x: rightLeft, y: bottom - height, width: right - rightLeft, height };
    }
  }

  return null;
}

/** Overlap area of two rects as a fraction of the smaller one. */
export function overlapFraction(a: Rect, b: Rect): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  if (x1 <= x0 || y1 <= y0) return 0;
  const overlap = (x1 - x0) * (y1 - y0);
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const smaller = Math.min(areaA, areaB);
  return smaller === 0 ? 0 : overlap / smaller;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const DETECT_SCALE = 2;
const OVERLAP_SKIP = 0.3;

/*
  Render the page, find its cells, and turn the empty ones into text fields.
  `items` are the scale-1 text boxes from detect-fields; `exclude` are rects of
  elements already placed (checkboxes, underscore blanks) so a cell field is not
  dropped on top of them.
*/
export async function detectCellFields(
  page: PDFPageProxy,
  meta: { pageWidth: number; pageHeight: number; rotation: PageGeometry["rotation"] },
  pageIndex: number,
  items: DetectTextItem[],
  exclude: Rect[],
  opts: DetectCellsOptions = DEFAULT_CELL_OPTIONS,
): Promise<OverlayElement[]> {
  const img = await rasterize(page);
  if (!img) return [];

  const hLevels = clusterLevels(findHorizontalSegments(img, opts), opts);
  const vLevels = clusterLevels(findVerticalSegments(img, opts), opts);
  const cells = detectCells(hLevels, vLevels, opts);

  const textBoxesPx = items.map((it) => ({
    x: it.x * DETECT_SCALE,
    y: it.y * DETECT_SCALE,
    width: it.width * DETECT_SCALE,
    height: it.height * DETECT_SCALE,
  }));

  const geom: PageGeometry = {
    pageWidth: meta.pageWidth,
    pageHeight: meta.pageHeight,
    scale: DETECT_SCALE,
    rotation: meta.rotation,
  };

  const elements: OverlayElement[] = [];
  const placed: Rect[] = [];
  for (const cell of cells) {
    const region = cellFieldRegion(cell, textBoxesPx, darkRatio(img, cell, opts.dark), opts);
    if (!region) continue;

    const rect = screenRectToPdf(region, geom);
    if (exclude.some((ex) => overlapFraction(ex, rect) > OVERLAP_SKIP)) continue;
    if (placed.some((p) => overlapFraction(p, rect) > OVERLAP_SKIP)) continue;
    placed.push(rect);

    elements.push({
      id: crypto.randomUUID(),
      kind: "text",
      pageIndex,
      rect,
      text: "",
      fontSize: clamp(Math.round(rect.height * 0.7), 8, 12),
      align: "left",
      source: "auto",
    });
  }
  return elements;
}

async function rasterize(page: PDFPageProxy): Promise<GrayImage | null> {
  const viewport = page.getViewport({ scale: DETECT_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  await page.render({ canvasContext: context, canvas, viewport }).promise;
  const data = context.getImageData(0, 0, canvas.width, canvas.height);
  return toGray(data.data, canvas.width, canvas.height);
}
