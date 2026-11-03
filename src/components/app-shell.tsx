"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { useUpload } from "@/features/dashboard/upload-context";

/*
  Persistent app chrome: a top bar plus a content region where screens render.
  Single-user local tool, so no sidebar. The Upload action opens the shared
  upload flow. Must render inside an UploadProvider.
*/
export function AppShell({ children }: { children: ReactNode }) {
  const upload = useUpload();

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <span className="text-h3 font-semibold text-foreground">PDF Filler</span>
        <Button onClick={upload.open}>
          <Icons.upload aria-hidden />
          Upload
        </Button>
      </header>
      <main className="flex-1 bg-background p-6">{children}</main>
    </div>
  );
}
