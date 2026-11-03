import { pdfSizeToScreen, screenRectToPdf, type PageGeometry, type Point, type Rect, type Size } from "@/lib/pdf/coords";
import type { OverlayElement, OverlayKind } from "@/schemas/overlay";

// Default element sizes in PDF points, by kind.
export const DEFAULT_SIZES_PT: Record<OverlayKind, Size> = {
  text: { width: 120, height: 24 },
  date: { width: 90, height: 20 },
  checkmark: { width: 18, height: 18 },
  signature: { width: 160, height: 60 },
};

const DEFAULT_FONT_SIZE_PT = 14;
const DEFAULT_DATE_FONT_SIZE_PT = 12;

/*
  Turn a click (screen px, relative to the page top-left, at the current zoom)
  into a stored rect in PDF points. The default size is in points; it is scaled
  to screen px, combined with the click as the top-left, then converted back to
  PDF space through coords.ts so the element lands under the click at any zoom and
  any page rotation.
*/
export function computePlacementRect(
  screenPoint: Point,
  kind: OverlayKind,
  geometry: PageGeometry,
): Rect {
  const screenSize = pdfSizeToScreen(DEFAULT_SIZES_PT[kind], geometry.scale);
  const screenRect: Rect = {
    x: screenPoint.x,
    y: screenPoint.y,
    width: screenSize.width,
    height: screenSize.height,
  };
  return screenRectToPdf(screenRect, geometry);
}

// How far a duplicate/paste is shifted from its source, in PDF points, so the
// copy is visible rather than exactly overlapping the original.
export const PASTE_OFFSET_PT = 12;

/*
  Clone an overlay element: a new id, every content and format field preserved
  (text/value, font size, alignment, color, checked, signature, and the rect's
  size), shifted by a small offset so the copy is visible. The clone is marked as
  manual (source cleared) so re-running auto-detection does not remove it. An
  optional pageIndex places the clone on a different page (for cross-page paste).
*/
export function duplicateOverlay(element: OverlayElement, pageIndex: number = element.pageIndex): OverlayElement {
  const clone = {
    ...element,
    id: crypto.randomUUID(),
    pageIndex,
    rect: {
      ...element.rect,
      x: element.rect.x + PASTE_OFFSET_PT,
      y: element.rect.y - PASTE_OFFSET_PT,
    },
  } as OverlayElement;
  delete (clone as { source?: "auto" }).source;
  return clone;
}

export function createOverlayElement(
  kind: OverlayKind,
  pageIndex: number,
  rect: Rect,
): OverlayElement {
  const base = { id: crypto.randomUUID(), pageIndex, rect };
  switch (kind) {
    case "text":
      return { ...base, kind: "text", text: "", fontSize: DEFAULT_FONT_SIZE_PT, align: "left" };
    case "date":
      return { ...base, kind: "date", value: "", fontSize: DEFAULT_DATE_FONT_SIZE_PT };
    case "checkmark":
      return { ...base, kind: "checkmark", checked: true };
    case "signature":
      return { ...base, kind: "signature" };
  }
}
