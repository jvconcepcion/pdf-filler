import { Suspense } from "react";
import { EditorView } from "@/features/editor/editor-view";

// Wrapped in Suspense: the editor reads the route param on the client (dynamic),
// which must sit inside a Suspense boundary for the static shell to prerender.
export default function EditorPage() {
  return (
    <Suspense fallback={<p className="p-6 text-small text-muted-foreground">Loading...</p>}>
      <EditorView />
    </Suspense>
  );
}
