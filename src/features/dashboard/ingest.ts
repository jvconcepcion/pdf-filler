import { loadPdfDocument } from "@/lib/pdf/setup";
import { renderThumbnail } from "@/lib/pdf/thumbnail";
import { createDocument } from "@/lib/db/documents";
import { notify } from "@/lib/toast";

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function nameFromFile(file: File): string {
  return file.name.replace(/\.pdf$/i, "");
}

/*
  Ingest one selected PDF into local storage. Unhappy paths (not a PDF, a corrupt
  or unparseable PDF, a read failure) are checked first / caught, each raising a
  plain error toast and creating no record, so there is never an orphaned row.
  Returns the new document id, or null on failure.

  The File itself is stored as the untouched original Blob. The engine is handed a
  separate arrayBuffer read and keeps its own private copy, so stored bytes are
  never mutated.
*/
export async function ingestPdf(file: File): Promise<string | null> {
  if (!isPdf(file)) {
    notify.error("Not a PDF, choose a PDF file");
    return null;
  }

  try {
    const buffer = await file.arrayBuffer();
    const doc = await loadPdfDocument(buffer);
    const pageCount = doc.numPages;
    const thumbnail = await renderThumbnail(doc);

    const id = await createDocument({
      name: nameFromFile(file),
      original: file,
      pageCount,
      thumbnail,
    });

    notify.success("Upload complete");
    // TODO (Phase 3): redirect to /editor/[id] on success.
    return id;
  } catch (error) {
    console.error("Upload failed", error);
    notify.error("Upload failed, retry");
    return null;
  }
}
