"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { updateDocument, type DocumentUpdate } from "@/lib/db/documents";

export type SaveStatus = "saved" | "saving" | "unsaved";

const DEBOUNCE_MS = 400;

/*
  Debounced, non-destructive autosave for a document, plus a derived save state.

  The payload is the set of fields to persist (overlays today; fieldValues slots
  in the same way once prompt 12 exists). The caller memoizes it, so its identity
  only changes when a tracked field changes. Status is derived, not set in an
  effect: "saving" while a write is in flight, otherwise "saved" when the current
  payload matches the last-saved one, else "unsaved" (a debounce is pending).

  A pending save is flushed on unmount (covers navigating away / route change)
  and on tab close or hide, so a fast exit never drops the last edits. Only the
  given fields are written; the original PDF bytes are never touched.
*/
export function useDocumentAutosave(documentId: string, payload: DocumentUpdate): SaveStatus {
  const [isSaving, setIsSaving] = useState(false);
  const [savedPayload, setSavedPayload] = useState<DocumentUpdate>(payload);

  const latest = useRef(payload);
  useEffect(() => {
    latest.current = payload;
  }, [payload]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirst = useRef(true);
  const mounted = useRef(true);
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const write = useCallback(() => {
    const snapshot = latest.current;
    setIsSaving(true);
    updateDocument(documentId, snapshot)
      .then(() => {
        if (!mounted.current) return;
        setIsSaving(false);
        setSavedPayload(snapshot);
      })
      .catch((error) => {
        console.error("Autosave failed", error);
        if (mounted.current) setIsSaving(false);
      });
  }, [documentId]);

  // Schedule a debounced save whenever the payload changes (skip the first run,
  // so merely opening a document does not write or bump updatedAt).
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      write();
    }, DEBOUNCE_MS);
  }, [payload, write]);

  // Flush on unmount (navigating away from the editor route).
  useEffect(() => {
    return () => {
      if (!timer.current) return;
      clearTimeout(timer.current);
      timer.current = null;
      void updateDocument(documentId, latest.current);
    };
  }, [documentId]);

  // Flush on tab close or when the tab is hidden.
  useEffect(() => {
    function flush() {
      if (!timer.current) return;
      clearTimeout(timer.current);
      timer.current = null;
      void updateDocument(documentId, latest.current);
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") flush();
    }
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [documentId]);

  if (isSaving) return "saving";
  return payload === savedPayload ? "saved" : "unsaved";
}
