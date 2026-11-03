"use client";

// Throwaway dev harness for the PDF engine. Not part of the real app flow.
// Delete this route (src/app/dev/) once the editor renders pages for real.

import { useEffect, useRef, useState } from "react";
import { loadPdfDocument } from "@/lib/pdf/setup";
import { renderPage } from "@/lib/pdf/renderPage";
import { renderThumbnail } from "@/lib/pdf/thumbnail";
import { useDocuments } from "@/hooks/useDocuments";
import { createDocument, deleteDocument } from "@/lib/db/documents";

const SAMPLE_URL = "/sample.pdf";
const SCALE = 1;

export default function PdfEngineHarness() {
  const pagesRef = useRef<HTMLDivElement>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdThumbUrl: string | null = null;

    async function run() {
      const container = pagesRef.current;
      if (!container) return;
      container.replaceChildren();

      const bytes = await (await fetch(SAMPLE_URL)).arrayBuffer();
      const doc = await loadPdfDocument(bytes);

      const lines: string[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const rendered = await renderPage(page, SCALE);
        if (cancelled) return;
        rendered.canvas.className = "border border-border shadow-panel bg-card";
        container.appendChild(rendered.canvas);
        lines.push(
          `page ${n}: ${rendered.width}x${rendered.height} css px, ` +
            `rotation ${rendered.rotation}, unrotated ${rendered.pageWidth}x${rendered.pageHeight} pt`,
        );
      }

      const thumb = await renderThumbnail(doc);
      if (cancelled) return;
      createdThumbUrl = URL.createObjectURL(thumb);
      setThumbUrl(createdThumbUrl);
      setMeta(lines);
    }

    run().catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    });

    return () => {
      cancelled = true;
      if (createdThumbUrl) URL.revokeObjectURL(createdThumbUrl);
    };
  }, []);

  return (
    <main className="min-h-full bg-background p-6 text-foreground">
      <h1 className="text-h2 font-semibold">PDF engine harness</h1>
      <p className="mt-1 text-small text-muted-foreground">
        Throwaway. Renders {SAMPLE_URL} and its page-1 thumbnail. Delete src/app/dev/ later.
      </p>

      {error ? (
        <p className="mt-4 text-small text-status-error">Error: {error}</p>
      ) : null}

      <section className="mt-6">
        <h2 className="text-h3 font-medium">Thumbnail</h2>
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt="Page 1 thumbnail"
            className="mt-2 border border-border shadow-panel"
          />
        ) : (
          <p className="mt-2 text-small text-muted-foreground">Rendering...</p>
        )}
      </section>

      <DbRoundTrip />

      <section className="mt-6">
        <h2 className="text-h3 font-medium">Pages</h2>
        <ul className="mt-2 space-y-1 font-mono text-caption text-muted-foreground">
          {meta.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div ref={pagesRef} className="mt-4 flex flex-col gap-6 bg-workspace p-6" />
      </section>
    </main>
  );
}

// Throwaway: confirms the Dexie CRUD round trip against real IndexedDB.
function DbRoundTrip() {
  const documents = useDocuments();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const original = await (await fetch(SAMPLE_URL)).blob();
      const doc = await loadPdfDocument(await original.arrayBuffer());
      const thumbnail = await renderThumbnail(doc);
      await createDocument({
        name: `Sample ${new Date().toLocaleTimeString()}`,
        original,
        pageCount: doc.numPages,
        thumbnail,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6">
      <h2 className="text-h3 font-medium">Dexie round trip</h2>
      <button
        type="button"
        onClick={() => void handleCreate()}
        disabled={busy}
        className="mt-2 rounded-md bg-primary px-3 py-1.5 text-small text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Creating..." : "Create document from sample"}
      </button>
      {error ? <p className="mt-2 text-small text-status-error">Error: {error}</p> : null}

      <ul className="mt-3 space-y-1 text-small">
        {documents === undefined ? (
          <li className="text-muted-foreground">Loading...</li>
        ) : documents.length === 0 ? (
          <li className="text-muted-foreground">No documents</li>
        ) : (
          documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3">
              <span className="font-mono text-caption text-muted-foreground">
                {doc.name} - {doc.pageCount}p - {doc.status}
              </span>
              <button
                type="button"
                onClick={() => void deleteDocument(doc.id)}
                className="text-caption text-status-error underline"
              >
                delete
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
