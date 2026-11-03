/*
  Client-side only. Renders page 1 at a small fixed on-screen width and returns
  a PNG Blob ready to store in Dexie later. Reuses renderPage so there is one
  render path, not two.
*/

import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { renderPage } from "./renderPage";

const DEFAULT_THUMBNAIL_WIDTH = 260;

export async function renderThumbnail(
  doc: PDFDocumentProxy,
  targetWidth: number = DEFAULT_THUMBNAIL_WIDTH,
): Promise<Blob> {
  const page = await doc.getPage(1);
  // Scale from the displayed width (getViewport includes rotation) so the
  // thumbnail is targetWidth wide regardless of page rotation.
  const displayedWidth = page.getViewport({ scale: 1 }).width;
  const scale = targetWidth / displayedWidth;

  const { canvas } = await renderPage(page, scale);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Failed to encode thumbnail"));
    }, "image/png");
  });
}
