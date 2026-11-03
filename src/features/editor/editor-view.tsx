"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useDocument } from "@/hooks/useDocument";
import { Button } from "@/components/ui/button";
import { PdfViewer } from "@/features/editor/pdf-viewer";

export function EditorView() {
  const params = useParams<{ docId: string }>();
  const document = useDocument(params.docId);

  if (document === undefined) {
    return <p className="p-6 text-small text-muted-foreground">Loading...</p>;
  }

  if (document === null) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 text-center">
        <p className="text-body text-muted-foreground">Document not found</p>
        <Button nativeButton={false} render={<Link href="/" />}>Back to dashboard</Button>
      </div>
    );
  }

  // Key by id so the viewer's overlay buffer re-seeds from Dexie per document.
  return <PdfViewer key={document.id} document={document} />;
}
