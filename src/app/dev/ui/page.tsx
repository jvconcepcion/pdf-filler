"use client";

// Throwaway showcase for the UI primitives. Not part of the real app.
// Delete src/app/dev/ once the real screens exist.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { ModalShell } from "@/components/ui/modal-shell";
import { Dropzone } from "@/features/dashboard/dropzone";
import { notify } from "@/lib/toast";

export default function UiShowcase() {
  const [modalOpen, setModalOpen] = useState(false);
  const [picked, setPicked] = useState<string>("none yet");

  return (
    <main className="min-h-full bg-background p-6 text-foreground">
      <h1 className="text-h2 font-semibold">UI primitives showcase</h1>
      <p className="mt-1 text-small text-muted-foreground">
        Throwaway. Delete src/app/dev/ later.
      </p>

      <section className="mt-6 space-y-3">
        <h2 className="text-h3 font-medium">Buttons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button disabled>Disabled</Button>
          <IconButton icon="trash" aria-label="Delete" variant="outline" />
          <IconButton icon="download" aria-label="Download" />
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-h3 font-medium">Status pills</h2>
        <div className="flex items-center gap-3">
          <StatusPill status="draft" />
          <StatusPill status="ready" />
        </div>
      </section>

      <section className="mt-6 max-w-sm">
        <h2 className="text-h3 font-medium">Card</h2>
        <Card className="mt-2">
          <CardHeader>
            <CardTitle>Document name</CardTitle>
            <CardDescription>Panel surface, border, radius, shadow from tokens.</CardDescription>
          </CardHeader>
          <CardContent>Card body content.</CardContent>
        </Card>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-h3 font-medium">Toasts</h2>
        <div className="flex gap-3">
          <Button onClick={() => notify.success("Saved")}>Success toast</Button>
          <Button variant="outline" onClick={() => notify.error("Export failed, retry")}>
            Error toast
          </Button>
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-h3 font-medium">Modal</h2>
        <Button onClick={() => setModalOpen(true)}>Open modal</Button>
        <ModalShell
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="Rename document"
          description="Generic header, body, footer slots."
          footer={
            <>
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setModalOpen(false)}>Save</Button>
            </>
          }
        >
          <p className="text-small text-muted-foreground">Body slot content goes here.</p>
        </ModalShell>
      </section>

      <section className="mt-6 max-w-md space-y-3">
        <h2 className="text-h3 font-medium">Dropzone</h2>
        <Dropzone onFiles={(files) => setPicked(files.map((f) => f.name).join(", "))} />
        <p className="text-small text-muted-foreground">Picked: {picked}</p>
      </section>
    </main>
  );
}
