import {
  computePlacementRect,
  createOverlayElement,
  duplicateOverlay,
  DEFAULT_SIZES_PT,
  PASTE_OFFSET_PT,
} from "./overlay-helpers";
import type { OverlayElement } from "@/schemas/overlay";
import { pdfRectToScreen, type PageGeometry, type Rotation } from "@/lib/pdf/coords";
import { overlayElementSchema } from "@/schemas/overlay";

function geom(rotation: Rotation, scale: number): PageGeometry {
  return { pageWidth: 612, pageHeight: 792, scale, rotation };
}

describe("computePlacementRect", () => {
  const click = { x: 200, y: 150 };

  it("round-trips: the element lands at the click, at the default screen size, for each rotation", () => {
    const rotations: Rotation[] = [0, 90, 180, 270];
    for (const rotation of rotations) {
      const scale = 1.5;
      const g = geom(rotation, scale);
      const rect = computePlacementRect(click, "text", g);
      const back = pdfRectToScreen(rect, g);
      expect(back.x).toBeCloseTo(click.x, 6);
      expect(back.y).toBeCloseTo(click.y, 6);
      expect(back.width).toBeCloseTo(DEFAULT_SIZES_PT.text.width * scale, 6);
      expect(back.height).toBeCloseTo(DEFAULT_SIZES_PT.text.height * scale, 6);
    }
  });

  it("stores size in PDF points independent of scale", () => {
    const rect = computePlacementRect(click, "checkmark", geom(0, 2));
    expect(rect.width).toBeCloseTo(DEFAULT_SIZES_PT.checkmark.width, 6);
    expect(rect.height).toBeCloseTo(DEFAULT_SIZES_PT.checkmark.height, 6);
  });
});

describe("createOverlayElement", () => {
  const rect = { x: 10, y: 20, width: 100, height: 40 };

  it("creates a schema-valid element for each kind", () => {
    for (const kind of ["text", "date", "checkmark", "signature"] as const) {
      const element = createOverlayElement(kind, 2, rect);
      expect(element.kind).toBe(kind);
      expect(element.pageIndex).toBe(2);
      expect(overlayElementSchema.safeParse(element).success).toBe(true);
    }
  });
});

describe("duplicateOverlay", () => {
  const source: OverlayElement = {
    id: "11111111-1111-1111-1111-111111111111",
    kind: "text",
    pageIndex: 0,
    rect: { x: 50, y: 60, width: 120, height: 24 },
    text: "Juan",
    fontSize: 11,
    align: "center",
    source: "auto",
  };

  it("keeps contents, format, and size but assigns a new id", () => {
    const copy = duplicateOverlay(source);
    expect(copy.id).not.toBe(source.id);
    expect(copy.kind).toBe("text");
    if (copy.kind !== "text") throw new Error("expected text");
    expect(copy.text).toBe("Juan");
    expect(copy.fontSize).toBe(11);
    expect(copy.align).toBe("center");
    expect(copy.rect.width).toBe(120);
    expect(copy.rect.height).toBe(24);
  });

  it("offsets the copy so it does not sit exactly on the original", () => {
    const copy = duplicateOverlay(source);
    expect(copy.rect.x).toBe(50 + PASTE_OFFSET_PT);
    expect(copy.rect.y).toBe(60 - PASTE_OFFSET_PT);
  });

  it("marks the copy as manual so auto-detect will not remove it", () => {
    expect(duplicateOverlay(source).source).toBeUndefined();
  });

  it("can place the copy on another page", () => {
    expect(duplicateOverlay(source, 3).pageIndex).toBe(3);
  });

  it("produces a schema-valid element", () => {
    expect(overlayElementSchema.safeParse(duplicateOverlay(source)).success).toBe(true);
  });
});
