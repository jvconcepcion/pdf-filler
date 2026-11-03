"use client";

import { useState } from "react";
import { ModalShell } from "@/components/ui/modal-shell";
import { Dropzone } from "@/features/dashboard/dropzone";
import { ingestPdf } from "@/features/dashboard/ingest";

export interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadDialog({ open, onOpenChange }: UploadDialogProps) {
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: File[]) {
    setBusy(true);
    let anySuccess = false;
    try {
      for (const file of files) {
        const id = await ingestPdf(file);
        if (id) anySuccess = true;
      }
    } finally {
      setBusy(false);
    }
    // Close on success; stay open on failure so the user can retry.
    if (anySuccess) onOpenChange(false);
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Upload a PDF"
      description="The file stays on your device."
    >
      <Dropzone onFiles={(files) => void handleFiles(files)} />
      {busy ? <p className="mt-3 text-small text-muted-foreground">Processing...</p> : null}
    </ModalShell>
  );
}
