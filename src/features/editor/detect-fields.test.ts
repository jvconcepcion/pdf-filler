import {
  BOX_GLYPHS,
  MIN_UNDERSCORE_RUN,
  detectElements,
  findUnderscoreRuns,
  isBoxGlyph,
  multiplyTransform,
  type DetectTextItem,
} from "./detect-fields";
import type { PageGeometry } from "@/lib/pdf/coords";

const geom: PageGeometry = { pageWidth: 600, pageHeight: 800, scale: 1, rotation: 0 };

describe("findUnderscoreRuns", () => {
  it("finds a run at or above the threshold", () => {
    expect(findUnderscoreRuns("Name: _____", 3)).toEqual([{ start: 6, length: 5 }]);
  });

  it("ignores runs below the threshold", () => {
    expect(findUnderscoreRuns("a_b__c", 3)).toEqual([]);
  });

  it("finds multiple runs in one string", () => {
    expect(findUnderscoreRuns("___ and _____", 3)).toEqual([
      { start: 0, length: 3 },
      { start: 8, length: 5 },
    ]);
  });

  it("handles a run that ends the string", () => {
    expect(findUnderscoreRuns("x____", 3)).toEqual([{ start: 1, length: 4 }]);
  });
});

describe("multiplyTransform", () => {
  it("composes with the identity to return the other matrix", () => {
    const identity = [1, 0, 0, 1, 0, 0];
    const m = [2, 0, 0, 3, 10, 20];
    expect(multiplyTransform(identity, m)).toEqual(m);
  });

  it("applies translation and scale in order", () => {
    // A scale-2 outer transform applied to an inner translation of (5, 7).
    expect(multiplyTransform([2, 0, 0, 2, 0, 0], [1, 0, 0, 1, 5, 7])).toEqual([2, 0, 0, 2, 10, 14]);
  });
});

describe("detectElements", () => {
  it("detects the Wingdings PUA box (U+F0A8) that Word forms use", () => {
    const items: DetectTextItem[] = [{ str: "", x: 30, y: 250, width: 7, height: 8 }];
    const found = detectElements(items, 0, geom).filter((e) => e.kind === "checkmark");
    expect(found).toHaveLength(1);
    if (found[0].kind !== "checkmark") throw new Error("expected checkmark");
    expect(found[0].checked).toBe(false);
    expect(found[0].source).toBe("auto");
  });

  it("creates an unchecked auto checkmark for a box glyph", () => {
    const items: DetectTextItem[] = [{ str: "☐", x: 100, y: 50, width: 12, height: 12 }];
    const [el] = detectElements(items, 0, geom);
    expect(el.kind).toBe("checkmark");
    if (el.kind !== "checkmark") throw new Error("expected checkmark");
    expect(el.checked).toBe(false);
    expect(el.source).toBe("auto");
    expect(el.pageIndex).toBe(0);
    // rot 0, scale 1: pdf y = pageHeight - screenY - height.
    expect(el.rect).toEqual({ x: 100, y: 800 - 50 - 12, width: 12, height: 12 });
  });

  it("creates an empty auto text field for an underscore blank", () => {
    const items: DetectTextItem[] = [{ str: "__________", x: 40, y: 120, width: 100, height: 10 }];
    const [el] = detectElements(items, 1, geom);
    expect(el.kind).toBe("text");
    if (el.kind !== "text") throw new Error("expected text");
    expect(el.text).toBe("");
    expect(el.source).toBe("auto");
    expect(el.fontSize).toBe(10);
    expect(el.rect).toEqual({ x: 40, y: 800 - 120 - 10, width: 100, height: 10 });
  });

  it("places a checkbox per glyph when several share one item", () => {
    const items: DetectTextItem[] = [{ str: "☐☐", x: 0, y: 0, width: 24, height: 12 }];
    const found = detectElements(items, 0, geom).filter((e) => e.kind === "checkmark");
    expect(found).toHaveLength(2);
  });

  it("ignores plain text with no box glyph or long underscore run", () => {
    const items: DetectTextItem[] = [{ str: "Full name", x: 10, y: 10, width: 60, height: 10 }];
    expect(detectElements(items, 0, geom)).toEqual([]);
  });

  it("skips degenerate items with no height", () => {
    const items: DetectTextItem[] = [{ str: "☐", x: 0, y: 0, width: 10, height: 0 }];
    expect(detectElements(items, 0, geom)).toEqual([]);
  });

  it("maps a box position correctly on a 90-rotated page", () => {
    const rotated: PageGeometry = { ...geom, rotation: 90 };
    const items: DetectTextItem[] = [{ str: "☐", x: 100, y: 50, width: 10, height: 10 }];
    const [el] = detectElements(items, 0, rotated);
    if (el.kind !== "checkmark") throw new Error("expected checkmark");
    // rot 90, scale 1: screenPointToPdf maps (sx, sy) -> (sy, sx); bounding box of
    // the two corners (100,50)-(110,60) -> pdf (50,100)-(60,110).
    expect(el.rect).toEqual({ x: 50, y: 100, width: 10, height: 10 });
  });
});

describe("isBoxGlyph", () => {
  it("matches explicit box codepoints regardless of shape", () => {
    expect(isBoxGlyph("❑", 7, 8)).toBe(true);
    expect(isBoxGlyph("", 7, 8)).toBe(true);
  });

  it("treats a square Private-Use glyph as a box", () => {
    expect(isBoxGlyph("", 7, 8)).toBe(true);
  });

  it("rejects a non-square Private-Use glyph (arrow, dash, quote)", () => {
    expect(isBoxGlyph("", 30, 8)).toBe(false);
  });

  it("rejects ordinary letters", () => {
    expect(isBoxGlyph("O", 8, 8)).toBe(false);
  });
});

describe("detection config", () => {
  it("includes the box glyphs the spec calls out", () => {
    expect(BOX_GLYPHS.has("❑")).toBe(true);
    expect(BOX_GLYPHS.has("☐")).toBe(true);
    expect(BOX_GLYPHS.has("□")).toBe(true);
  });

  it("uses a sane underscore threshold", () => {
    expect(MIN_UNDERSCORE_RUN).toBeGreaterThanOrEqual(3);
  });
});
