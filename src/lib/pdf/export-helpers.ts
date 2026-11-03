import type { Point, Rect, Size } from "@/lib/pdf/coords";
import type { OverlayElement } from "@/schemas/overlay";

/*
  Pure layout math for export, free of pdf-lib and the DOM so it is unit-testable.
  Everything here works in "display space": the upright, top-left-origin view the
  user sees, measured in PDF points. coords.ts is what maps these display points
  into pdf-lib's user space; this module never converts between coordinate
  systems itself, it only lays elements out the same way the editor does.
*/

export type TextAlign = "left" | "center" | "right";

// Line box height as a multiple of font size. Matches the editor's leading-tight
// (line-height 1.25), so multi-line export spacing matches the inline editor.
export const LINE_HEIGHT_RATIO = 1.25;

// Baseline drop from the top of a line box, as a multiple of font size:
// Helvetica's ascent (~0.718) plus the half-leading above it ((1.25 - 1) / 2).
// This lines the exported baseline up with where the editor paints the glyphs.
export const BASELINE_RATIO = 0.718 + (LINE_HEIGHT_RATIO - 1) / 2;

/** x where a line starts, given its box and the measured text width. */
export function alignedTextX(
  boxX: number,
  boxWidth: number,
  textWidth: number,
  align: TextAlign,
): number {
  if (align === "center") return boxX + (boxWidth - textWidth) / 2;
  if (align === "right") return boxX + (boxWidth - textWidth);
  return boxX;
}

/**
 * Contain-fit an image into a box, preserving aspect ratio and centering it,
 * matching the on-screen object-contain rendering. Returns a top-left-origin
 * rect in the box's own space (offset from the box top-left).
 */
export function containRect(box: Size, image: Size): Rect {
  if (box.width <= 0 || box.height <= 0 || image.width <= 0 || image.height <= 0) {
    return { x: 0, y: 0, width: Math.max(0, box.width), height: Math.max(0, box.height) };
  }
  const scale = Math.min(box.width / image.width, box.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { x: (box.width - width) / 2, y: (box.height - height) / 2, width, height };
}

// The lucide "check" glyph (path "M20 6 9 17l-5-5") normalized to its 24-unit
// viewBox, so the exported check has the same shape and padding as the icon the
// editor draws.
const CHECK_POINTS_NORM: ReadonlyArray<Point> = [
  { x: 20 / 24, y: 6 / 24 },
  { x: 9 / 24, y: 17 / 24 },
  { x: 4 / 24, y: 12 / 24 },
];

/** The three display-space points of the check, mapped into the element rect. */
export function checkPolyline(rect: Rect): [Point, Point, Point] {
  const points = CHECK_POINTS_NORM.map((p) => ({
    x: rect.x + p.x * rect.width,
    y: rect.y + p.y * rect.height,
  }));
  return [points[0], points[1], points[2]];
}

/** Stroke width for the check, scaled to the rect (lucide uses 2 of 24 units). */
export function checkThickness(rect: Rect): number {
  const base = Math.min(rect.width, rect.height);
  return Math.max(0.75, (base * 2) / 24);
}

/**
 * Whether an element draws anything in the exported PDF. An unchecked checkmark
 * (an auto-detected box the user left empty) and an empty text/date field export
 * nothing, so the form's own printed box or line shows through cleanly.
 */
export function elementProducesOutput(element: OverlayElement): boolean {
  if (element.kind === "checkmark") return element.checked;
  if (element.kind === "text") return element.text.trim().length > 0;
  if (element.kind === "date") return element.value.trim().length > 0;
  return true;
}

/** Download filename for a document: its name, cleaned, with a -filled.pdf suffix. */
export function buildExportFilename(name: string): string {
  const withoutExt = name.trim().replace(/\.pdf$/i, "");
  const safe = withoutExt
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return `${safe || "document"}-filled.pdf`;
}
