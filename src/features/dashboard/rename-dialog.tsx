"use client";

import { useState } from "react";
import { ModalShell } from "@/components/ui/modal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { renameDocument } from "@/lib/db/documents";

export interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  currentName: string;
}

export function RenameDialog({ open, onOpenChange, documentId, currentName }: RenameDialogProps) {
  const [name, setName] = useState(currentName);

  // Reset the field to the current name each time the dialog opens, without an
  // effect: track the previous open state and adjust during render.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setName(currentName);
  }

  const trimmed = name.trim();

  async function handleSave() {
    if (!trimmed) return;
    await renameDocument(documentId, trimmed);
    onOpenChange(false);
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Rename document"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={!trimmed}>
            Save
          </Button>
        </>
      }
    >
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-label="Document name"
        autoFocus
      />
    </ModalShell>
  );
}
