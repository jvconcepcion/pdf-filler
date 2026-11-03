"use client";

import { useRef, type MouseEvent } from "react";
import { Rnd } from "react-rnd";
import { pdfRectToScreen, screenRectToPdf, type PageGeometry } from "@/lib/pdf/coords";
import { useEditorStore } from "@/store/editor-store";
import { Icons, type IconName } from "@/components/icons";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import { computePlacementRect, createOverlayElement } from "@/features/editor/overlay-helpers";
import { isoToDisplay, displayToIso } from "@/features/editor/date-format";
import { SignatureImage } from "@/features/signature/signature-image";
import type { OverlayElement } from "@/schemas/overlay";
import type { Signature } from "@/schemas/signature";

const MIN_FONT_PT = 6;
const MAX_FONT_PT = 96;
const FONT_STEP_PT = 1;

// Below this screen-y, the floating toolbar would clip above the page, so it
// flips to sit below the element instead.
const TOOLBAR_FLIP_Y = 48;

type TextAlign = "left" | "center" | "right";

function clampFont(size: number): number {
  return Math.min(MAX_FONT_PT, Math.max(MIN_FONT_PT, size));
}

export interface OverlayLayerProps {
  pageIndex: number;
  geometry: PageGeometry;
  elements: OverlayElement[];
  signatures: Signature[];
  onAdd: (element: OverlayElement) => void;
  onMutate: (id: string, mutate: (element: OverlayElement) => OverlayElement) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRequestAttach: (id: string) => void;
}

export function OverlayLayer({
  pageIndex,
  geometry,
  elements,
  signatures,
  onAdd,
  onMutate,
  onRemove,
  onDuplicate,
  onRequestAttach,
}: OverlayLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const selectedElementId = useEditorStore((s) => s.selectedElementId);
  const setSelectedElementId = useEditorStore((s) => s.setSelectedElementId);

  function handleLayerClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;

    if (activeTool === "select") {
      setSelectedElementId(null);
      return;
    }

    const layer = layerRef.current;
    if (!layer) return;
    const bounds = layer.getBoundingClientRect();
    const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    const rect = computePlacementRect(point, activeTool, geometry);
    const element = createOverlayElement(activeTool, pageIndex, rect);
    onAdd(element);
    setSelectedElementId(element.id);
    setActiveTool("select");
    // A freshly placed signature has nothing attached yet; open the library.
    if (element.kind === "signature") onRequestAttach(element.id);
  }

  function setFontSize(id: string, next: number) {
    onMutate(id, (element) =>
      element.kind === "text" || element.kind === "date"
        ? { ...element, fontSize: clampFont(next) }
        : element,
    );
  }

  function setAlign(id: string, align: TextAlign) {
    onMutate(id, (element) => (element.kind === "text" ? { ...element, align } : element));
  }

  function setText(id: string, text: string) {
    onMutate(id, (element) => (element.kind === "text" ? { ...element, text } : element));
  }

  function setDate(id: string, iso: string) {
    onMutate(id, (element) => (element.kind === "date" ? { ...element, value: isoToDisplay(iso) } : element));
  }

  function toggleChecked(id: string) {
    onMutate(id, (element) =>
      element.kind === "checkmark" ? { ...element, checked: !element.checked } : element,
    );
  }

  return (
    <div
      ref={layerRef}
      onClick={handleLayerClick}
      className={`absolute inset-0 ${activeTool === "select" ? "" : "cursor-crosshair"}`}
    >
      {elements.map((element) => {
        const screenRect = pdfRectToScreen(element.rect, geometry);
        const selected = element.id === selectedElementId;
        const signatureBlob =
          element.kind === "signature" && element.signatureId
            ? signatures.find((s) => s.id === element.signatureId)?.image
            : undefined;

        if (!selected) {
          return (
            <button
              key={element.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedElementId(element.id);
                if (element.kind === "checkmark") toggleChecked(element.id);
              }}
              style={{
                left: screenRect.x,
                top: screenRect.y,
                width: screenRect.width,
                height: screenRect.height,
              }}
              className="absolute border border-dashed border-primary/40 p-0 hover:border-primary/70 hover:bg-primary/5"
            >
              <DisplayContent element={element} scale={geometry.scale} signatureBlob={signatureBlob} />
            </button>
          );
        }

        return (
          <Rnd
            key={element.id}
            size={{ width: screenRect.width, height: screenRect.height }}
            position={{ x: screenRect.x, y: screenRect.y }}
            bounds="parent"
            dragHandleClassName="overlay-drag"
            onDragStop={(_event, data) => {
              onMutate(element.id, (el) => ({
                ...el,
                rect: screenRectToPdf(
                  { x: data.x, y: data.y, width: screenRect.width, height: screenRect.height },
                  geometry,
                ),
              }));
            }}
            onResizeStop={(_event, _direction, ref, _delta, position) => {
              onMutate(element.id, (el) => ({
                ...el,
                rect: screenRectToPdf(
                  { x: position.x, y: position.y, width: ref.offsetWidth, height: ref.offsetHeight },
                  geometry,
                ),
              }));
            }}
            className="z-10 ring-2 ring-primary"
          >
            <div className="relative h-full w-full">
              {element.kind === "text" ? (
                <textarea
                  autoFocus
                  value={element.text}
                  onChange={(event) => setText(element.id, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") event.currentTarget.blur();
                  }}
                  style={{ fontSize: element.fontSize * geometry.scale, textAlign: element.align ?? "left" }}
                  className="font-overlay block h-full w-full resize-none border-0 bg-transparent p-0 leading-tight text-foreground outline-none"
                />
              ) : (
                <div
                  className="h-full w-full"
                  onClick={() => {
                    if (element.kind === "checkmark") toggleChecked(element.id);
                  }}
                >
                  <DisplayContent element={element} scale={geometry.scale} signatureBlob={signatureBlob} />
                </div>
              )}

              <SelectedToolbar
                element={element}
                placement={screenRect.y < TOOLBAR_FLIP_Y ? "below" : "above"}
                onFontSize={(next) => setFontSize(element.id, next)}
                onAlign={(align) => setAlign(element.id, align)}
                onDateChange={(iso) => setDate(element.id, iso)}
                onRequestAttach={() => onRequestAttach(element.id)}
                onDuplicate={() => onDuplicate(element.id)}
                onRemove={() => onRemove(element.id)}
              />
            </div>
          </Rnd>
        );
      })}
    </div>
  );
}

function DisplayContent({
  element,
  scale,
  signatureBlob,
}: {
  element: OverlayElement;
  scale: number;
  signatureBlob?: Blob;
}) {
  if (element.kind === "text") {
    return (
      <span
        style={{ fontSize: element.fontSize * scale, textAlign: element.align ?? "left" }}
        className={`font-overlay block h-full w-full overflow-hidden leading-tight whitespace-pre-wrap ${element.text ? "text-foreground" : "text-muted-foreground"}`}
      >
        {element.text || "Text"}
      </span>
    );
  }

  if (element.kind === "date") {
    return (
      <span
        style={{ fontSize: element.fontSize * scale }}
        className={`font-overlay block h-full w-full overflow-hidden leading-tight ${element.value ? "text-foreground" : "text-muted-foreground"}`}
      >
        {element.value || "mm/dd/yyyy"}
      </span>
    );
  }

  if (element.kind === "checkmark") {
    if (element.checked) {
      return <Icons.check className="h-full w-full text-foreground" aria-hidden />;
    }
    // Unchecked: nothing prints, but show a faint clickable hotspot in the editor
    // so the toggle target is visible. This affordance is never exported.
    return (
      <span
        className="block h-full w-full rounded-sm border border-dashed border-primary/50 bg-primary/5"
        aria-hidden
      />
    );
  }

  // signature
  if (signatureBlob) {
    return <SignatureImage blob={signatureBlob} className="h-full w-full object-contain" />;
  }
  return (
    <span className="flex h-full w-full items-center justify-center border border-dashed border-primary/40 text-caption text-muted-foreground">
      Choose signature
    </span>
  );
}

function SelectedToolbar({
  element,
  placement,
  onFontSize,
  onAlign,
  onDateChange,
  onRequestAttach,
  onDuplicate,
  onRemove,
}: {
  element: OverlayElement;
  placement: "above" | "below";
  onFontSize: (next: number) => void;
  onAlign: (align: TextAlign) => void;
  onDateChange: (iso: string) => void;
  onRequestAttach: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const fontSize = element.kind === "text" || element.kind === "date" ? element.fontSize : 0;
  const pos = placement === "below" ? "top-full mt-2" : "bottom-full mb-2";

  return (
    <div
      className={`absolute left-0 ${pos} flex items-center gap-1 rounded-md border border-border bg-card p-1 shadow-popover`}
    >
      <span
        className="overlay-drag flex h-7 w-5 cursor-move items-center justify-center text-muted-foreground"
        aria-hidden
      >
        <Icons.move />
      </span>
      <div className="h-4 w-px bg-border" />

      {element.kind === "date" ? (
        <input
          type="date"
          value={displayToIso(element.value)}
          onChange={(event) => onDateChange(event.target.value)}
          className="h-7 rounded border border-input bg-transparent px-1 text-small text-foreground outline-none"
        />
      ) : null}

      {element.kind === "text" || element.kind === "date" ? (
        <>
          <IconButton
            icon="minus"
            aria-label="Decrease font size"
            variant="ghost"
            size="icon-xs"
            onClick={() => onFontSize(fontSize - FONT_STEP_PT)}
          />
          <span className="w-6 text-center text-caption tabular-nums text-muted-foreground">{fontSize}</span>
          <IconButton
            icon="plus"
            aria-label="Increase font size"
            variant="ghost"
            size="icon-xs"
            onClick={() => onFontSize(fontSize + FONT_STEP_PT)}
          />
        </>
      ) : null}

      {element.kind === "text" ? (
        <>
          <div className="h-4 w-px bg-border" />
          {(["left", "center", "right"] as const).map((align) => {
            const icon: IconName =
              align === "left" ? "alignLeft" : align === "center" ? "alignCenter" : "alignRight";
            return (
              <IconButton
                key={align}
                icon={icon}
                aria-label={`Align ${align}`}
                aria-pressed={(element.align ?? "left") === align}
                variant={(element.align ?? "left") === align ? "default" : "ghost"}
                size="icon-xs"
                onClick={() => onAlign(align)}
              />
            );
          })}
        </>
      ) : null}

      {element.kind === "signature" ? (
        <Button variant="outline" size="sm" onClick={onRequestAttach}>
          {element.signatureId ? "Change signature" : "Choose signature"}
        </Button>
      ) : null}

      <div className="h-4 w-px bg-border" />
      <IconButton
        icon="copy"
        aria-label="Duplicate element"
        variant="ghost"
        size="icon-sm"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={onDuplicate}
      />
      <IconButton
        icon="trash"
        aria-label="Delete element"
        variant="destructive"
        size="icon-sm"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={onRemove}
      />
    </div>
  );
}
