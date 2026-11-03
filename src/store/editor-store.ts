import { create } from "zustand";

/*
  Editor UI state only. Everything here is transient view state for the editor
  chrome, never document data: which tool is armed, the render scale, and which
  page is in view. The loaded PDF and the document record stay out of here; they
  come from pdf.js and Dexie respectively. selectedElementId / panel state are
  deliberately absent until the overlay layer needs them (prompt 11).
*/
export type EditorTool = "select" | "text" | "checkmark" | "date" | "signature";

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
const ZOOM_STEP = 1.2;

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

interface EditorState {
  activeTool: EditorTool;
  setActiveTool: (tool: EditorTool) => void;

  zoom: number;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;

  currentPage: number;
  setCurrentPage: (page: number) => void;

  selectedElementId: string | null;
  setSelectedElementId: (id: string | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  activeTool: "select",
  setActiveTool: (tool) => set({ activeTool: tool }),

  zoom: 1,
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  zoomIn: () => set((state) => ({ zoom: clampZoom(state.zoom * ZOOM_STEP) })),
  zoomOut: () => set((state) => ({ zoom: clampZoom(state.zoom / ZOOM_STEP) })),

  currentPage: 1,
  setCurrentPage: (page) => set({ currentPage: page }),

  selectedElementId: null,
  setSelectedElementId: (id) => set({ selectedElementId: id }),
}));
