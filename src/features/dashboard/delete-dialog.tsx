"use client";

import { ModalShell } from "@/components/ui/modal-shell";
import { Button } from "@/components/ui/button";
import { deleteDocument } from "@/lib/db/documents";
import { notify } from "@/lib/toast";

export interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  name: string;
}

export function DeleteDialog({ open, onOpenChange, documentId, name }: DeleteDialogProps) {
  async function handleDelete() {
    await deleteDocument(documentId);
    notify.success("Document deleted");
    onOpenChange(false);
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Delete document"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void handleDelete()}>
            Delete
          </Button>
        </>
      }
    >
      <p className="text-small text-muted-foreground">
        Delete &quot;{name}&quot;? This cannot be undone.
      </p>
    </ModalShell>
  );
}
