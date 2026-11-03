"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { UploadDialog } from "@/features/dashboard/upload-dialog";

/*
  One upload flow, reachable from more than one place (the top-bar button and the
  empty-state button). The provider owns the single UploadDialog instance; any
  descendant calls useUpload().open() to raise it.
*/
interface UploadContextValue {
  open: () => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function UploadProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const value = useMemo<UploadContextValue>(() => ({ open: () => setIsOpen(true) }), []);

  return (
    <UploadContext.Provider value={value}>
      {children}
      <UploadDialog open={isOpen} onOpenChange={setIsOpen} />
    </UploadContext.Provider>
  );
}

export function useUpload(): UploadContextValue {
  const context = useContext(UploadContext);
  if (!context) throw new Error("useUpload must be used within an UploadProvider");
  return context;
}
