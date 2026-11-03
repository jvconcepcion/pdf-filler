"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { loadPdfDocument } from "@/lib/pdf/setup";
import { PageView } from "@/features/editor/page-view";
import { EditorToolbar } from "@/features/editor/editor-toolbar";
import { OverlayLayer } from "@/features/editor/overlay-layer";
import { SignatureDialog } from "@/features/signature/signature-dialog";
import { useSignatures } from "@/hooks/useSignatures";
import { useDocumentAutosave } from "@/hooks/useDocumentAutosave";
import { exportDocument } from "@/lib/pdf/export";
import { detectElements, extractTextItems } from "@/features/editor/detect-fields";
import { detectCellFields } from "@/features/editor/detect-cells";
import { duplicateOverlay } from "@/features/editor/overlay-helpers";
import { notify } from "@/lib/toast";
import { useEditorStore, MIN_ZOOM, MAX_ZOOM } from "@/store/editor-store";
import { normalizeRotation, type Rotation } from "@/lib/pdf/coords";
import type { OverlayElement } from "@/schemas/overlay";
import type { DocumentRecord } from "@/schemas/document";

interface PageMeta {
  pageWidth: number; // unrotated points
  pageHeight: number; // unrotated points
  rotation: Rotation;
  displayWidth: number; // rotated display size at scale 1
  displayHeight: number;
}

const SCROLL_PADDING = 48; // matches the p-6 workspace padding, for fit-to-width

export function PdfViewer({ document }: { document: DocumentRecord }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PageMeta[]>([]);

  // Working copy of the overlays. Edits apply here immediately for a responsive
  // drag/resize, and are persisted to Dexie (the source of truth) on a debounce.
  // This is a transient editing buffer, seeded once from Dexie per document, not
  // a second source of truth and not in Zustand.
  const [overlays, setOverlays] = useState<OverlayElement[]>(document.overlays);

  // The signature element awaiting a pick (null = dialog closed).
  const [attachTargetId, setAttachTargetId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const signatures = useSignatures();

  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const setCurrentPage = useEditorStore((s) => s.setCurrentPage);
  const setSelectedElementId = useEditorStore((s) => s.setSelectedElementId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef<Map<number, HTMLElement>>(new Map());

  const latestDoc = useRef(document);
  useEffect(() => {
    latestDoc.current = document;
  });

  // Current overlays and a copy buffer, kept in refs so the global key handler
  // stays stable and always sees the latest without re-subscribing.
  const overlaysRef = useRef(overlays);
  useEffect(() => {
    overlaysRef.current = overlays;
  });
  const clipboardRef = useRef<OverlayElement | null>(null);

  // Start each document fresh.
  useEffect(() => {
    setZoom(1);
    setCurrentPage(1);
    setSelectedElementId(null);
  }, [document.id, setZoom, setCurrentPage, setSelectedElementId]);

  // Load the PDF once per id (original bytes never change for an id).
  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    async function load() {
      try {
        const doc = await loadPdfDocument(latestDoc.current.original);
        if (cancelled) {
          void doc.loadingTask.destroy();
          return;
        }
        loaded = doc;
        const metas: PageMeta[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          const viewport = page.getViewport({ scale: 1 });
          const [x0, y0, x1, y1] = page.view;
          metas.push({
            pageWidth: x1 - x0,
            pageHeight: y1 - y0,
            rotation: normalizeRotation(viewport.rotation),
            displayWidth: viewport.width,
            displayHeight: viewport.height,
          });
        }
        if (cancelled) return;
        setPdf(doc);
        setPages(metas);
      } catch (error) {
        console.error("Failed to load PDF", error);
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (loaded) void loaded.loadingTask.destroy();
    };
  }, [document.id]);

  // Debounced, non-destructive autosave. The payload is memoized so later steps
  // add fieldValues to it the same way (original bytes are never touched;
  // DocumentUpdate cannot accept them).
  const savePayload = useMemo(() => ({ overlays }), [overlays]);
  const saveStatus = useDocumentAutosave(document.id, savePayload);

  const addElement = useCallback((element: OverlayElement) => {
    setOverlays((prev) => [...prev, element]);
  }, []);

  const mutateElement = useCallback(
    (id: string, mutate: (element: OverlayElement) => OverlayElement) => {
      setOverlays((prev) => prev.map((element) => (element.id === id ? mutate(element) : element)));
    },
    [],
  );

  const removeElement = useCallback(
    (id: string) => {
      setOverlays((prev) => prev.filter((element) => element.id !== id));
      if (useEditorStore.getState().selectedElementId === id) setSelectedElementId(null);
    },
    [setSelectedElementId],
  );

  // Duplicate an element in place (content, format, and size preserved), and
  // select the copy so it can be moved or chained with another duplicate.
  const duplicateElement = useCallback(
    (id: string) => {
      const element = overlaysRef.current.find((el) => el.id === id);
      if (!element) return;
      const copy = duplicateOverlay(element);
      addElement(copy);
      setSelectedElementId(copy.id);
    },
    [addElement, setSelectedElementId],
  );

  const copyElement = useCallback((id: string) => {
    const element = overlaysRef.current.find((el) => el.id === id);
    if (element) clipboardRef.current = element;
  }, []);

  const pasteElement = useCallback(() => {
    const template = clipboardRef.current;
    if (!template) return;
    const pageIndex = Math.max(0, useEditorStore.getState().currentPage - 1);
    const copy = duplicateOverlay(template, pageIndex);
    addElement(copy);
    setSelectedElementId(copy.id);
  }, [addElement, setSelectedElementId]);

  // Delete / Backspace removes the selected element (unless typing in a field or
  // the signature dialog is open).
  const attachOpenRef = useRef(false);
  useEffect(() => {
    attachOpenRef.current = attachTargetId !== null;
  }, [attachTargetId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const inField =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const selectedId = useEditorStore.getState().selectedElementId;
      const mod = event.ctrlKey || event.metaKey;

      // Duplicate works even while editing text (no conflicting default).
      if (mod && (event.key === "d" || event.key === "D")) {
        if (!selectedId) return;
        event.preventDefault();
        duplicateElement(selectedId);
        return;
      }
      // Copy/paste only when not typing, so text copy/paste inside a field is untouched.
      if (mod && !inField && (event.key === "c" || event.key === "C")) {
        if (selectedId) copyElement(selectedId);
        return;
      }
      if (mod && !inField && (event.key === "v" || event.key === "V")) {
        event.preventDefault();
        pasteElement();
        return;
      }

      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (attachOpenRef.current || inField || !selectedId) return;
      event.preventDefault();
      removeElement(selectedId);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [removeElement, duplicateElement, copyElement, pasteElement]);

  const getPage = useCallback(
    (n: number) => {
      if (!pdf) return Promise.reject(new Error("PDF not loaded"));
      return pdf.getPage(n);
    },
    [pdf],
  );

  const registerPage = useCallback((n: number, el: HTMLElement | null) => {
    if (el) pageEls.current.set(n, el);
    else pageEls.current.delete(n);
  }, []);

  // Track the most-visible page for the indicator.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || pages.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let bestPage = 0;
        let bestRatio = 0;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestPage = Number((entry.target as HTMLElement).dataset.page);
          }
        }
        if (bestPage > 0) setCurrentPage(bestPage);
      },
      { root, threshold: [0.1, 0.3, 0.5, 0.75] },
    );
    pageEls.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pages.length, setCurrentPage]);

  const fitToWidth = useCallback(() => {
    const root = scrollRef.current;
    if (!root || pages.length === 0) return;
    const widest = Math.max(...pages.map((meta) => meta.displayWidth));
    const available = root.clientWidth - SCROLL_PADDING;
    setZoom(available / widest);
  }, [pages, setZoom]);

  const goToPage = useCallback(
    (n: number) => {
      const clamped = Math.min(pages.length, Math.max(1, n));
      pageEls.current.get(clamped)?.scrollIntoView({ block: "start", behavior: "smooth" });
      setCurrentPage(clamped);
    },
    [pages.length, setCurrentPage],
  );

  // Export the current on-screen state: the live overlays buffer (which may be
  // ahead of the autosaved record by a debounce) over the untouched original.
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportDocument({ ...document, overlays });
    } catch (error) {
      console.error("Export failed", error);
      notify.error(error instanceof Error ? error.message : "Export failed, retry");
    } finally {
      setExporting(false);
    }
  }, [document, overlays]);

  // Auto-detect checkboxes and underscore blanks on text-layer PDFs. Replaces the
  // previous auto-placed set and leaves manually placed elements untouched.
  const handleDetect = useCallback(async () => {
    if (!pdf || pages.length === 0) return;
    setDetecting(true);
    try {
      const detected: OverlayElement[] = [];
      for (let i = 0; i < pages.length; i++) {
        const meta = pages[i];
        const page = await pdf.getPage(i + 1);
        const items = await extractTextItems(page);
        // Text-layer pass: checkbox glyphs and underscore blanks.
        const glyphElements = detectElements(items, i, {
          pageWidth: meta.pageWidth,
          pageHeight: meta.pageHeight,
          scale: 1,
          rotation: meta.rotation,
        });
        // Raster pass: a field in every empty grid cell, skipping the above.
        const cellElements = await detectCellFields(
          page,
          { pageWidth: meta.pageWidth, pageHeight: meta.pageHeight, rotation: meta.rotation },
          i,
          items,
          glyphElements.map((element) => element.rect),
        );
        detected.push(...glyphElements, ...cellElements);
      }
      if (detected.length === 0) {
        notify.error("No fields detected. This form likely has no text layer (scanned).");
        return;
      }
      setOverlays((prev) => [...prev.filter((element) => element.source !== "auto"), ...detected]);
      notify.success(`Detected ${detected.length} field${detected.length === 1 ? "" : "s"}.`);
    } catch (error) {
      console.error("Field detection failed", error);
      notify.error("Field detection failed, retry");
    } finally {
      setDetecting(false);
    }
  }, [pdf, pages]);

  const effectiveZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

  return (
    <div className="flex h-dvh flex-col">
      <EditorToolbar
        documentName={document.name}
        numPages={pages.length}
        saveStatus={saveStatus}
        exporting={exporting}
        detecting={detecting}
        onDetect={handleDetect}
        onExport={handleExport}
        onFitWidth={fitToWidth}
        onJumpToPage={goToPage}
      />

      <div ref={scrollRef} className="flex-1 overflow-auto bg-workspace">
        <div className="flex flex-col items-center gap-6 p-6">
          {pages.map((meta, index) => (
            <PageView
              key={index + 1}
              pageNumber={index + 1}
              width={meta.displayWidth * effectiveZoom}
              height={meta.displayHeight * effectiveZoom}
              scale={effectiveZoom}
              getPage={getPage}
              registerRef={registerPage}
            >
              <OverlayLayer
                pageIndex={index}
                geometry={{
                  pageWidth: meta.pageWidth,
                  pageHeight: meta.pageHeight,
                  scale: effectiveZoom,
                  rotation: meta.rotation,
                }}
                elements={overlays.filter((element) => element.pageIndex === index)}
                signatures={signatures ?? []}
                onAdd={addElement}
                onMutate={mutateElement}
                onRemove={removeElement}
                onDuplicate={duplicateElement}
                onRequestAttach={setAttachTargetId}
              />
            </PageView>
          ))}
        </div>
      </div>

      <SignatureDialog
        open={attachTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setAttachTargetId(null);
        }}
        onAttach={(signatureId) => {
          if (attachTargetId) {
            mutateElement(attachTargetId, (element) =>
              element.kind === "signature" ? { ...element, signatureId } : element,
            );
          }
          setAttachTargetId(null);
        }}
      />
    </div>
  );
}
