"use client";

import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { cn } from "cn";
import { Icons } from "@/components/icons";

/*
  Presentational drop area: click-to-pick plus drag-and-drop, PDFs only. It hands
  the selected File(s) up to its caller and nothing more. It does not read bytes,
  store anything, or know about Dexie; that wiring lives in a later step.
*/
export interface DropzoneProps {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  className?: string;
}

function pdfsOnly(fileList: FileList | null): File[] {
  if (!fileList) return [];
  return Array.from(fileList).filter(
    (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
  );
}

export function Dropzone({ onFiles, multiple = false, className }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function openPicker() {
    inputRef.current?.click();
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = pdfsOnly(event.target.files);
    if (files.length > 0) onFiles(files);
    event.target.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    const files = pdfsOnly(event.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }

  return (
    <button
      type="button"
      onClick={openPicker}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-card p-10 text-center transition-colors",
        "hover:border-primary/50 hover:bg-muted",
        dragging && "border-primary bg-primary/5",
        className,
      )}
    >
      <Icons.upload className="size-8 text-muted-foreground" aria-hidden />
      <span className="text-body font-medium text-foreground">
        Drop a PDF here, or click to choose
      </span>
      <span className="text-small text-muted-foreground">PDF files only</span>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple={multiple}
        onChange={handleInputChange}
        className="hidden"
      />
    </button>
  );
}
