"use client";

import { useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { ModalShell } from "@/components/ui/modal-shell";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { SignatureImage } from "@/features/signature/signature-image";
import { Icons } from "@/components/icons";
import { useSignatures } from "@/hooks/useSignatures";
import { saveSignature, deleteSignature } from "@/lib/db/signatures";
import { notify } from "@/lib/toast";

export interface SignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAttach: (signatureId: string) => void;
}

type Mode = "library" | "capture";
type CaptureMode = "draw" | "type";

function inkColor(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim();
  return value || "#111827";
}

function renderTypedSignature(canvas: HTMLCanvasElement, text: string, ink: string) {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = 'italic 44px Georgia, "Times New Roman", serif';
  ctx.fillText(text || "Signature", width / 2, height / 2);
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export function SignatureDialog({ open, onOpenChange, onAttach }: SignatureDialogProps) {
  const signatures = useSignatures();
  const [mode, setMode] = useState<Mode>("library");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("draw");
  const [name, setName] = useState("");

  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const typeCanvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  // Reset to the library each time the dialog opens, without an effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setMode("library");
      setName("");
    }
  }

  // Draw mode: set up signature_pad on the canvas (HiDPI aware).
  useEffect(() => {
    if (!open || mode !== "capture" || captureMode !== "draw") return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);
    const pad = new SignaturePad(canvas, { penColor: inkColor() });
    padRef.current = pad;
    return () => {
      pad.off();
      padRef.current = null;
    };
  }, [open, mode, captureMode]);

  // Type mode: render the preview whenever the name changes.
  useEffect(() => {
    if (!open || mode !== "capture" || captureMode !== "type") return;
    const canvas = typeCanvasRef.current;
    if (!canvas) return;
    renderTypedSignature(canvas, name, inkColor());
  }, [open, mode, captureMode, name]);

  function startCapture() {
    setCaptureMode("draw");
    setName("");
    setMode("capture");
  }

  function pick(id: string) {
    onAttach(id);
    onOpenChange(false);
  }

  async function remove(id: string) {
    await deleteSignature(id);
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      notify.error("Enter a name for the signature");
      return;
    }
    if (captureMode === "draw" && padRef.current?.isEmpty()) {
      notify.error("Draw a signature first");
      return;
    }

    const canvas = captureMode === "draw" ? drawCanvasRef.current : typeCanvasRef.current;
    if (!canvas) return;
    if (captureMode === "type") renderTypedSignature(canvas, trimmed, inkColor());

    const blob = await canvasToPng(canvas);
    if (!blob) {
      notify.error("Could not save signature, retry");
      return;
    }
    const id = await saveSignature({ name: trimmed, image: blob });
    onAttach(id);
    onOpenChange(false);
  }

  const libraryFooter = (
    <Button onClick={startCapture}>
      <Icons.plus aria-hidden />
      New signature
    </Button>
  );

  const captureFooter = (
    <>
      <Button variant="outline" onClick={() => setMode("library")}>
        Cancel
      </Button>
      <Button onClick={() => void save()}>Save</Button>
    </>
  );

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "library" ? "Signatures" : "New signature"}
      footer={mode === "library" ? libraryFooter : captureFooter}
    >
      {mode === "library" ? (
        <SignatureList signatures={signatures} onPick={pick} onDelete={(id) => void remove(id)} />
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              variant={captureMode === "draw" ? "default" : "outline"}
              size="sm"
              onClick={() => setCaptureMode("draw")}
            >
              Draw
            </Button>
            <Button
              variant={captureMode === "type" ? "default" : "outline"}
              size="sm"
              onClick={() => setCaptureMode("type")}
            >
              Type
            </Button>
          </div>

          {captureMode === "draw" ? (
            <div className="space-y-2">
              <canvas ref={drawCanvasRef} className="h-40 w-full rounded-md border border-border bg-card" />
              <Button variant="ghost" size="sm" onClick={() => padRef.current?.clear()}>
                Clear
              </Button>
            </div>
          ) : (
            <canvas ref={typeCanvasRef} className="h-32 w-full rounded-md border border-border bg-card" />
          )}

          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Signature name"
            aria-label="Signature name"
          />
        </div>
      )}
    </ModalShell>
  );
}

function SignatureList({
  signatures,
  onPick,
  onDelete,
}: {
  signatures: ReturnType<typeof useSignatures>;
  onPick: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (signatures === undefined) {
    return <p className="text-small text-muted-foreground">Loading...</p>;
  }
  if (signatures.length === 0) {
    return <p className="text-small text-muted-foreground">No signatures yet</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-3">
      {signatures.map((signature) => (
        <li key={signature.id} className="relative">
          <button
            type="button"
            onClick={() => onPick(signature.id)}
            className="flex w-full flex-col items-stretch gap-1 rounded-md border border-border p-2 text-left hover:border-primary"
          >
            <SignatureImage blob={signature.image} className="h-16 w-full object-contain" />
            <span className="truncate text-caption text-muted-foreground">{signature.name}</span>
          </button>
          <IconButton
            icon="trash"
            aria-label={`Delete ${signature.name}`}
            variant="destructive"
            size="icon-xs"
            className="absolute -top-2 -right-2"
            onClick={() => onDelete(signature.id)}
          />
        </li>
      ))}
    </ul>
  );
}
