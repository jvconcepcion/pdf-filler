"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Icons, type IconName } from "@/components/icons";
import { useEditorStore, type EditorTool } from "@/store/editor-store";
import type { SaveStatus } from "@/hooks/useDocumentAutosave";

const SAVE_LABELS: Record<SaveStatus, string> = {
  saved: "Saved",
  saving: "Saving...",
  unsaved: "Unsaved changes",
};

const TOOLS: { tool: EditorTool; icon: IconName; label: string }[] = [
  { tool: "select", icon: "select", label: "Select" },
  { tool: "text", icon: "type", label: "Text" },
  { tool: "checkmark", icon: "check", label: "Checkmark" },
  { tool: "date", icon: "calendar", label: "Date" },
  { tool: "signature", icon: "signature", label: "Signature" },
];

export interface EditorToolbarProps {
  documentName: string;
  numPages: number;
  saveStatus: SaveStatus;
  exporting: boolean;
  detecting: boolean;
  onDetect: () => void;
  onExport: () => void;
  onFitWidth: () => void;
  onJumpToPage: (page: number) => void;
}

export function EditorToolbar({
  documentName,
  numPages,
  saveStatus,
  exporting,
  detecting,
  onDetect,
  onExport,
  onFitWidth,
  onJumpToPage,
}: EditorToolbarProps) {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const zoom = useEditorStore((s) => s.zoom);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const currentPage = useEditorStore((s) => s.currentPage);

  return (
    <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-2">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/" />}>
        <Icons.chevronLeft aria-hidden />
        Dashboard
      </Button>
      <span className="max-w-48 truncate text-small font-medium text-foreground">{documentName}</span>
      <span
        className={`text-caption ${saveStatus === "saved" ? "text-muted-foreground" : "text-foreground"}`}
      >
        {SAVE_LABELS[saveStatus]}
      </span>

      <div className="mx-auto flex items-center gap-1">
        {TOOLS.map(({ tool, icon, label }) => (
          <IconButton
            key={tool}
            icon={icon}
            aria-label={label}
            aria-pressed={activeTool === tool}
            variant={activeTool === tool ? "default" : "ghost"}
            size="icon-sm"
            onClick={() => setActiveTool(tool)}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <IconButton icon="zoomOut" aria-label="Zoom out" variant="outline" size="icon-sm" onClick={zoomOut} />
        <span className="w-12 text-center text-small tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <IconButton icon="zoomIn" aria-label="Zoom in" variant="outline" size="icon-sm" onClick={zoomIn} />
        <Button variant="outline" size="sm" onClick={onFitWidth}>
          Fit width
        </Button>

        <div className="mx-2 h-5 w-px bg-border" />

        <IconButton
          icon="chevronLeft"
          aria-label="Previous page"
          variant="outline"
          size="icon-sm"
          onClick={() => onJumpToPage(currentPage - 1)}
        />
        <PageJump currentPage={currentPage} numPages={numPages} onJump={onJumpToPage} />
        <IconButton
          icon="chevronRight"
          aria-label="Next page"
          variant="outline"
          size="icon-sm"
          onClick={() => onJumpToPage(currentPage + 1)}
        />

        <div className="mx-2 h-5 w-px bg-border" />

        <Button variant="outline" size="sm" onClick={onDetect} disabled={detecting}>
          <Icons.scan aria-hidden />
          {detecting ? "Detecting..." : "Auto-detect fields"}
        </Button>

        <Button variant="outline" size="sm" onClick={onExport} disabled={exporting}>
          <Icons.download aria-hidden />
          {exporting ? "Exporting..." : "Export"}
        </Button>
      </div>
    </header>
  );
}

function PageJump({
  currentPage,
  numPages,
  onJump,
}: {
  currentPage: number;
  numPages: number;
  onJump: (page: number) => void;
}) {
  const [field, setField] = useState(String(currentPage));

  // Keep the field in sync with scroll-driven page changes, without an effect.
  const [prevPage, setPrevPage] = useState(currentPage);
  if (currentPage !== prevPage) {
    setPrevPage(currentPage);
    setField(String(currentPage));
  }

  function commit() {
    const parsed = Number.parseInt(field, 10);
    if (Number.isFinite(parsed)) onJump(parsed);
    else setField(String(currentPage));
  }

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        commit();
      }}
    >
      <Input
        value={field}
        onChange={(event) => setField(event.target.value)}
        onBlur={commit}
        inputMode="numeric"
        aria-label="Page number"
        className="h-7 w-12 text-center"
      />
      <span className="text-small tabular-nums text-muted-foreground">/ {numPages}</span>
    </form>
  );
}
