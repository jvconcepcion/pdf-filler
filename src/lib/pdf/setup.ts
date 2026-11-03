/*
  Client-side only. pdf.js is loaded through a dynamic import so none of it runs
  during server rendering (it touches browser-only globals at module eval).

  Worker wiring: approach (a) from the plan. `new URL(..., import.meta.url)`
  lets the bundler emit the worker that ships with our installed pdfjs-dist and
  hand back a local URL. No CDN, works offline, and the worker version is always
  locked to the main-thread version because both come from the same package.
*/

import type {
  DocumentInitParameters,
  PDFDocumentProxy,
} from "pdfjs-dist/types/src/display/api";

type PdfjsModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfjsModule> | null = null;

function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

async function toBytes(source: ArrayBuffer | Uint8Array | Blob): Promise<Uint8Array> {
  // pdf.js transfers the backing buffer to the worker, which would detach the
  // caller's bytes. Always hand it a private copy so stored originals are safe.
  if (source instanceof Blob) {
    return new Uint8Array(await source.arrayBuffer());
  }
  const view = source instanceof Uint8Array ? source : new Uint8Array(source);
  return view.slice();
}

export async function loadPdfDocument(
  source: ArrayBuffer | Uint8Array | Blob,
  options?: Omit<DocumentInitParameters, "data">,
): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  const data = await toBytes(source);
  return pdfjs.getDocument({ ...options, data }).promise;
}
