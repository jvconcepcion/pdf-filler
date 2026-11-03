/*
  The single source of coordinate math for the app. Pure and framework-free:
  no DOM, no pdf.js, no pdf-lib. This is what makes it unit-testable and what
  guarantees the WYSIWYG promise, so nothing else does coordinate math inline.

  Two coordinate systems:
  - Screen: top-left origin, y grows downward, CSS pixels, at the current
    render scale and the page's current rotation (what pdf.js draws to canvas).
  - PDF: bottom-left origin, y grows upward, PDF points, in the page's own
    unrotated coordinate space (what pdf-lib draws in).

  The forward transforms below are the algebraic inverse of pdf.js's
  PageViewport matrix for rotations 0/90/180/270, so a point placed on the
  rendered page lands at the same spot a pdf-lib-drawn element will appear.

  `pageWidth` / `pageHeight` are the page's UNROTATED dimensions in points (the
  viewBox, i.e. pdf-lib's page.getSize()), not the rotated on-screen size.
  Overlay elements are stored in PDF space so they survive zoom and reopen;
  screen positions are re-derived from them at the current scale.
*/

export type Rotation = 0 | 90 | 180 | 270;

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageGeometry {
  /** Unrotated page width in PDF points. */
  pageWidth: number;
  /** Unrotated page height in PDF points. */
  pageHeight: number;
  /** Render scale: CSS pixels per PDF point. */
  scale: number;
  /** Page rotation applied on screen. */
  rotation: Rotation;
}

export function normalizeRotation(rotation: number): Rotation {
  const r = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  return r as Rotation;
}

/**
 * A point in PDF space -> the screen point it renders at.
 * Returns a screen point (top-left origin, CSS pixels).
 */
export function pdfPointToScreen(point: Point, geom: PageGeometry): Point {
  const { pageWidth: w, pageHeight: h, scale: s, rotation } = geom;
  const { x, y } = point;
  switch (rotation) {
    case 90:
      return { x: y * s, y: x * s };
    case 180:
      return { x: (w - x) * s, y: y * s };
    case 270:
      return { x: (h - y) * s, y: (w - x) * s };
    default:
      return { x: x * s, y: (h - y) * s };
  }
}

/**
 * A point on the rendered page -> the PDF-space point it corresponds to.
 * Exact inverse of pdfPointToScreen. Returns a PDF point (bottom-left origin,
 * points), which is what gets stored for an overlay element.
 */
export function screenPointToPdf(point: Point, geom: PageGeometry): Point {
  const { pageWidth: w, pageHeight: h, scale: s, rotation } = geom;
  const sx = point.x / s;
  const sy = point.y / s;
  switch (rotation) {
    case 90:
      return { x: sy, y: sx };
    case 180:
      return { x: w - sx, y: sy };
    case 270:
      return { x: w - sy, y: h - sx };
    default:
      return { x: sx, y: h - sy };
  }
}

/**
 * Length/size magnitude conversion. Scale only, rotation-independent: a 100px
 * line is 100/scale points long at any rotation. Use for scalars like font
 * size or stroke width. For a positioned box use the rect helpers, which
 * account for the 90/270 axis swap.
 */
export function screenSizeToPdf(size: Size, scale: number): Size {
  return { width: size.width / scale, height: size.height / scale };
}

export function pdfSizeToScreen(size: Size, scale: number): Size {
  return { width: size.width * scale, height: size.height * scale };
}

/**
 * A screen-space axis-aligned rect (x,y = top-left, CSS px) -> the PDF-space
 * axis-aligned rect (x,y = bottom-left, points). Converts both corners and
 * takes the bounding box, so the width/height axis swap under 90/270 rotation
 * is handled correctly. This is the natural shape to store for an overlay.
 */
export function screenRectToPdf(rect: Rect, geom: PageGeometry): Rect {
  const a = screenPointToPdf({ x: rect.x, y: rect.y }, geom);
  const b = screenPointToPdf({ x: rect.x + rect.width, y: rect.y + rect.height }, geom);
  return boundingRect(a, b);
}

/**
 * A stored PDF-space rect -> the screen rect to render it at the current scale.
 * Inverse of screenRectToPdf.
 */
export function pdfRectToScreen(rect: Rect, geom: PageGeometry): Rect {
  const a = pdfPointToScreen({ x: rect.x, y: rect.y }, geom);
  const b = pdfPointToScreen({ x: rect.x + rect.width, y: rect.y + rect.height }, geom);
  return boundingRect(a, b);
}

function boundingRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}
