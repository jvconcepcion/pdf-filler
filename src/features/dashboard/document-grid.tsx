"use client";

import { useDocuments } from "@/hooks/useDocuments";
import { DocumentCard } from "@/features/dashboard/document-card";
import { useUpload } from "@/features/dashboard/upload-context";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";

function EmptyState() {
  const upload = useUpload();
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="text-body text-muted-foreground">No documents yet</p>
      <Button onClick={upload.open}>
        <Icons.upload aria-hidden />
        Upload
      </Button>
    </div>
  );
}

export function DocumentGrid() {
  const documents = useDocuments();

  if (documents === undefined) {
    return <p className="text-small text-muted-foreground">Loading...</p>;
  }

  if (documents.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4">
      {documents.map((document) => (
        <DocumentCard key={document.id} document={document} />
      ))}
    </div>
  );
}
