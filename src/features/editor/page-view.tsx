"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { PDFPageProxy } from "pdfjs-dist/types/src/display/api";
import { renderPage } from "@/lib/pdf/renderPage";

export interface PageViewProps {
  pageNumber: number;
  /** Container size in CSS px at the current scale (from the page viewport). */
  width: number;
  height: number;
  scale: number;
  getPage: (n: number) => Promise<PDFPageProxy>;
  registerRef: (n: number, el: HTMLElement | null) => void;
  /** Overlay layer, rendered absolutely over the canvas. Always mounted. */
  children?: ReactNode;
}

/*
  One page. Its container is sized up front from the page's viewport, so layout
  is stable before anything renders. An IntersectionObserver with a buffer margin
  flips `visible` on/off; the <canvas> is only mounted while visible, so pages
  scrolled far away release their backing store. Keying the canvas on `scale`
  remounts a fresh canvas on zoom, which avoids pdf.js rendering twice onto the
  same canvas.
*/
export function PageView({ pageNumber, width, height, scale, getPage, registerRef, children }: PageViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  const setContainer = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el;
      registerRef(pageNumber, el);
    },
    [pageNumber, registerRef],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries[0].isIntersecting),
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    async function render() {
      try {
        const page = await getPage(pageNumber);
        if (cancelled) return;
        await renderPage(page, scale, canvas!);
      } catch (error) {
        console.error(`Failed to render page ${pageNumber}`, error);
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [visible, scale, pageNumber, getPage]);

  return (
    <div
      ref={setContainer}
      data-page={pageNumber}
      style={{ width, height }}
      className="relative shrink-0 bg-card shadow-panel"
    >
      {visible ? <canvas key={scale} ref={canvasRef} className="block" /> : null}
      {children}
    </div>
  );
}
