/*
  Client-side only. Renders one page to a canvas and returns exactly the
  metadata the rest of the app needs. Only a type-level pdfjs import is used, so
  this module adds no runtime pdfjs code and is safe to import from anywhere a
  PDFPageProxy is already in hand.

  HiDPI: the canvas backing store is sized by devicePixelRatio for crisp output,
  but the returned width/height are CSS pixels. The coordinate module works in
  CSS pixels and never needs to know about devicePixelRatio.
*/

import type { PDFPageProxy } from "pdfjs-dist/types/src/display/api";
import { normalizeRotation, type Rotation } from "./coords";

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  /** On-screen width in CSS pixels (rotated size at this scale). */
  width: number;
  /** On-screen height in CSS pixels (rotated size at this scale). */
  height: number;
  /** Scale used (CSS pixels per PDF point). */
  scale: number;
  rotation: Rotation;
  /** Unrotated page width in PDF points, for coords.ts. */
  pageWidth: number;
  /** Unrotated page height in PDF points, for coords.ts. */
  pageHeight: number;
}

function devicePixelRatio(): number {
  return typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
}

export async function renderPage(
  page: PDFPageProxy,
  scale: number,
  canvas?: HTMLCanvasElement,
): Promise<RenderedPage> {
  const viewport = page.getViewport({ scale });
  const dpr = devicePixelRatio();
  const renderViewport = dpr === 1 ? viewport : page.getViewport({ scale: scale * dpr });

  const target = canvas ?? document.createElement("canvas");
  target.width = Math.round(renderViewport.width);
  target.height = Math.round(renderViewport.height);
  target.style.width = `${viewport.width}px`;
  target.style.height = `${viewport.height}px`;

  await page.render({ canvas: target, viewport: renderViewport }).promise;

  const [x0, y0, x1, y1] = page.view;

  return {
    canvas: target,
    width: viewport.width,
    height: viewport.height,
    scale,
    rotation: normalizeRotation(viewport.rotation),
    pageWidth: x1 - x0,
    pageHeight: y1 - y0,
  };
}
