"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { StatusPill } from "@/components/ui/status-pill";
import { Icons } from "@/components/icons";
import { RenameDialog } from "@/features/dashboard/rename-dialog";
import { DeleteDialog } from "@/features/dashboard/delete-dialog";
import type { DocumentRecord } from "@/schemas/document";

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/*
  Attach the stored thumbnail Blob to the <img> through an object URL set
  imperatively in an effect, and revoke it on unmount or when the Blob changes,
  so no object URL leaks. Done via a ref (not React state) to keep the object
  URL's create/revoke lifecycle inside the effect.
*/
function useThumbnail(thumbnail: Blob | undefined) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (!img || !thumbnail) return;
    const objectUrl = URL.createObjectURL(thumbnail);
    img.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [thumbnail]);

  return ref;
}

export function DocumentCard({ document }: { document: DocumentRecord }) {
  const router = useRouter();
  const thumbnailRef = useThumbnail(document.thumbnail);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // TODO (Phase 3): the /editor/[id] route does not exist yet, so this lands on
  // not-found for now. It lights up when the editor is built.
  function open() {
    router.push(`/editor/${document.id}`);
  }

  return (
    <Card className="overflow-hidden">
      {document.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={thumbnailRef}
          alt=""
          className="h-44 w-full bg-workspace object-contain"
        />
      ) : (
        <div className="flex h-44 w-full items-center justify-center bg-workspace">
          <Icons.file className="size-10 text-muted-foreground" aria-hidden />
        </div>
      )}

      <CardHeader>
        <CardTitle className="truncate">{document.name}</CardTitle>
        <CardDescription>Updated {formatDate(document.updatedAt)}</CardDescription>
        <CardAction>
          <StatusPill status={document.status} />
        </CardAction>
      </CardHeader>

      <CardFooter className="gap-2">
        <Button className="flex-1" onClick={open}>
          Open
        </Button>
        <IconButton icon="type" aria-label="Rename" variant="outline" onClick={() => setRenameOpen(true)} />
        <IconButton icon="trash" aria-label="Delete" variant="outline" onClick={() => setDeleteOpen(true)} />
      </CardFooter>

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        documentId={document.id}
        currentName={document.name}
      />
      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        documentId={document.id}
        name={document.name}
      />
    </Card>
  );
}
