import type { PDFPageProxy } from "pdfjs-dist/types/src/display/api";
import { screenRectToPdf, screenSizeToPdf, type PageGeometry } from "@/lib/pdf/coords";
import type { OverlayElement } from "@/schemas/overlay";

/*
  Auto field detection for flat forms that have a real text layer. It is an
  assist on top of the normal overlay model: everything it produces is an
  ordinary overlay element the user can move, edit, toggle, or delete, stored in
  PDF points like every other overlay.

  Detection is split so the geometry is testable:
  - extractTextItems (impure) reads pdf.js text content and flattens each item to
    a screen-space bounding box (top-left origin, points at scale 1).
  - detectElements (pure) turns those boxes into overlay elements, converting
    every position through coords.ts. This is the unit-tested part.

  It finds two things only: checkbox glyphs and underscore-run blanks. Scanned,
  image-only PDFs have no text layer and yield nothing here (OCR is deferred).
*/

/** A text-layer item flattened to a screen-space box (top-left origin, points). */
export interface DetectTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Box-glyph characters a flat form might use for a checkbox. Configurable set;
// covers the ones the spec calls out, common square variants, and U+F0A8, the
// Private-Use codepoint pdf.js emits for the Wingdings box that Word-made forms
// (e.g. Pag-IBIG HLF-068) use heavily.
export const BOX_GLYPHS: ReadonlySet<string> = new Set([
  "❑", // lower right shadowed white square
  "☐", // ballot box
  "□", // white square
  "■", // black square (some forms print a filled box)
  "◻", // white medium square
  "⬜", // white large square
  "❏", // lower right drop-shadowed white square
  "", // Wingdings box (Private Use Area)
]);

// Many Word forms draw checkboxes with a symbol font whose glyphs land in the
// Unicode Private Use Area, so there is no portable codepoint to match. Such a
// glyph with a roughly square footprint is treated as a checkbox; the square
// test keeps arrows, dashes, and quotes (which are not square) from matching.
const PUA_START = 0xe000;
const PUA_END = 0xf8ff;
const SQUARE_MIN_RATIO = 0.55;
const SQUARE_MAX_RATIO = 1.7;

/** Whether a single glyph should be read as a checkbox, by codepoint or shape. */
export function isBoxGlyph(ch: string, glyphWidth: number, glyphHeight: number): boolean {
  if (BOX_GLYPHS.has(ch)) return true;
  const cp = ch.codePointAt(0) ?? 0;
  if (cp < PUA_START || cp > PUA_END || glyphHeight <= 0 || glyphWidth <= 0) return false;
  const ratio = glyphWidth / glyphHeight;
  return ratio >= SQUARE_MIN_RATIO && ratio <= SQUARE_MAX_RATIO;
}

export const MIN_UNDERSCORE_RUN = 3;

/** Maximal runs of underscores in a string, at or above a length threshold. */
export function findUnderscoreRuns(
  str: string,
  minLength: number,
): Array<{ start: number; length: number }> {
  const runs: Array<{ start: number; length: number }> = [];
  let start = -1;
  for (let i = 0; i <= str.length; i++) {
    const isUnderscore = str[i] === "_";
    if (isUnderscore && start === -1) {
      start = i;
      continue;
    }
    if (!isUnderscore && start !== -1) {
      const length = i - start;
      if (length >= minLength) runs.push({ start, length });
      start = -1;
    }
  }
  return runs;
}

/** 2x3 affine transform multiply (pdf.js Util.transform), kept pure for testing. */
export function multiplyTransform(a: number[], b: number[]): number[] {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export function detectElements(
  items: DetectTextItem[],
  pageIndex: number,
  geometry: PageGeometry,
): OverlayElement[] {
  const elements: OverlayElement[] = [];
  for (const item of items) {
    if (item.height <= 0 || item.width <= 0) continue;
    elements.push(...detectCheckboxes(item, pageIndex, geometry));
    elements.push(...detectBlanks(item, pageIndex, geometry));
  }
  return elements;
}

function detectCheckboxes(
  item: DetectTextItem,
  pageIndex: number,
  geometry: PageGeometry,
): OverlayElement[] {
  const out: OverlayElement[] = [];
  const cellWidth = item.width / Math.max(1, item.str.length);
  const side = item.height;
  for (let i = 0; i < item.str.length; i++) {
    if (!isBoxGlyph(item.str[i], cellWidth, item.height)) continue;
    const cellX = item.x + i * cellWidth;
    const rect = screenRectToPdf(
      {
        x: cellX + Math.max(0, (cellWidth - side) / 2),
        y: item.y,
        width: side,
        height: side,
      },
      geometry,
    );
    out.push({
      id: crypto.randomUUID(),
      kind: "checkmark",
      pageIndex,
      rect,
      checked: false,
      source: "auto",
    });
  }
  return out;
}

function detectBlanks(
  item: DetectTextItem,
  pageIndex: number,
  geometry: PageGeometry,
): OverlayElement[] {
  const runs = findUnderscoreRuns(item.str, MIN_UNDERSCORE_RUN);
  if (runs.length === 0) return [];
  const cellWidth = item.width / Math.max(1, item.str.length);
  const fontSize = Math.max(1, screenSizeToPdf({ width: 0, height: item.height }, geometry.scale).height);
  return runs.map((run) => {
    const rect = screenRectToPdf(
      {
        x: item.x + run.start * cellWidth,
        y: item.y,
        width: run.length * cellWidth,
        height: item.height,
      },
      geometry,
    );
    return {
      id: crypto.randomUUID(),
      kind: "text",
      pageIndex,
      rect,
      text: "",
      fontSize,
      align: "left",
      source: "auto",
    };
  });
}

/** Read a page's text layer and flatten each item to a screen-space box (scale 1). */
export async function extractTextItems(page: PDFPageProxy): Promise<DetectTextItem[]> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items: DetectTextItem[] = [];
  for (const raw of content.items) {
    if (!("str" in raw) || !("transform" in raw)) continue;
    const transform = multiplyTransform(viewport.transform, raw.transform);
    const fontHeight = Math.hypot(transform[1], transform[3]);
    if (fontHeight <= 0 || raw.str.length === 0) continue;
    items.push({
      str: raw.str,
      x: transform[4],
      y: transform[5] - fontHeight,
      width: raw.width,
      height: fontHeight,
    });
  }
  return items;
}
