import {
  BASELINE_RATIO,
  LINE_HEIGHT_RATIO,
  alignedTextX,
  buildExportFilename,
  checkPolyline,
  checkThickness,
  containRect,
  elementProducesOutput,
} from "./export-helpers";
import type { OverlayElement } from "@/schemas/overlay";

const baseRect = { x: 0, y: 0, width: 10, height: 10 };
const id = "00000000-0000-0000-0000-000000000000";

describe("alignedTextX", () => {
  it("left-aligns at the box start", () => {
    expect(alignedTextX(10, 100, 40, "left")).toBe(10);
  });

  it("centers the text within the box", () => {
    expect(alignedTextX(10, 100, 40, "center")).toBe(10 + 30);
  });

  it("right-aligns against the box end", () => {
    expect(alignedTextX(10, 100, 40, "right")).toBe(10 + 60);
  });

  it("does not depend on box origin for the offset", () => {
    const left = alignedTextX(0, 100, 40, "center");
    const shifted = alignedTextX(50, 100, 40, "center");
    expect(shifted - left).toBe(50);
  });
});

describe("containRect", () => {
  it("fits a wide image by width and centers it vertically", () => {
    const r = containRect({ width: 200, height: 200 }, { width: 100, height: 50 });
    expect(r.width).toBe(200);
    expect(r.height).toBe(100);
    expect(r.x).toBe(0);
    expect(r.y).toBe(50);
  });

  it("fits a tall image by height and centers it horizontally", () => {
    const r = containRect({ width: 200, height: 200 }, { width: 50, height: 100 });
    expect(r.height).toBe(200);
    expect(r.width).toBe(100);
    expect(r.y).toBe(0);
    expect(r.x).toBe(50);
  });

  it("preserves aspect ratio", () => {
    const r = containRect({ width: 300, height: 90 }, { width: 400, height: 200 });
    expect(r.width / r.height).toBeCloseTo(400 / 200, 6);
  });

  it("falls back to the box for a degenerate image", () => {
    const r = containRect({ width: 120, height: 60 }, { width: 0, height: 0 });
    expect(r).toEqual({ x: 0, y: 0, width: 120, height: 60 });
  });
});

describe("checkPolyline", () => {
  it("maps the lucide check into the element rect", () => {
    const [a, b, c] = checkPolyline({ x: 0, y: 0, width: 24, height: 24 });
    expect(a).toEqual({ x: 20, y: 6 });
    expect(b).toEqual({ x: 9, y: 17 });
    expect(c).toEqual({ x: 4, y: 12 });
  });

  it("offsets and scales with the rect", () => {
    const [a] = checkPolyline({ x: 10, y: 100, width: 48, height: 48 });
    expect(a).toEqual({ x: 10 + 40, y: 100 + 12 });
  });
});

describe("checkThickness", () => {
  it("scales with the smaller rect dimension", () => {
    expect(checkThickness({ x: 0, y: 0, width: 240, height: 120 })).toBeCloseTo((120 * 2) / 24, 6);
  });

  it("has a lower bound", () => {
    expect(checkThickness({ x: 0, y: 0, width: 2, height: 2 })).toBe(0.75);
  });
});

describe("buildExportFilename", () => {
  it("appends the -filled suffix", () => {
    expect(buildExportFilename("Pag-IBIG")).toBe("Pag-IBIG-filled.pdf");
  });

  it("drops an existing .pdf extension before suffixing", () => {
    expect(buildExportFilename("form.pdf")).toBe("form-filled.pdf");
  });

  it("strips characters that are invalid in filenames", () => {
    expect(buildExportFilename('a/b:c*?"<>|d')).toBe("a_b_c_d-filled.pdf");
  });

  it("falls back to a default when the name is empty", () => {
    expect(buildExportFilename("   ")).toBe("document-filled.pdf");
  });
});

describe("elementProducesOutput", () => {
  it("draws a checked checkmark and skips an unchecked one", () => {
    const checked: OverlayElement = { id, pageIndex: 0, rect: baseRect, kind: "checkmark", checked: true };
    const unchecked: OverlayElement = { id, pageIndex: 0, rect: baseRect, kind: "checkmark", checked: false };
    expect(elementProducesOutput(checked)).toBe(true);
    expect(elementProducesOutput(unchecked)).toBe(false);
  });

  it("skips empty text and draws non-empty text", () => {
    const empty: OverlayElement = { id, pageIndex: 0, rect: baseRect, kind: "text", text: "   ", fontSize: 12 };
    const filled: OverlayElement = { id, pageIndex: 0, rect: baseRect, kind: "text", text: "Juan", fontSize: 12 };
    expect(elementProducesOutput(empty)).toBe(false);
    expect(elementProducesOutput(filled)).toBe(true);
  });

  it("skips an empty date and draws a set date", () => {
    const empty: OverlayElement = { id, pageIndex: 0, rect: baseRect, kind: "date", value: "", fontSize: 12 };
    const set: OverlayElement = { id, pageIndex: 0, rect: baseRect, kind: "date", value: "01/02/2026", fontSize: 12 };
    expect(elementProducesOutput(empty)).toBe(false);
    expect(elementProducesOutput(set)).toBe(true);
  });

  it("always draws a signature element (resolution handled during draw)", () => {
    const sig: OverlayElement = { id, pageIndex: 0, rect: baseRect, kind: "signature" };
    expect(elementProducesOutput(sig)).toBe(true);
  });
});

describe("layout constants", () => {
  it("matches the editor leading-tight line height", () => {
    expect(LINE_HEIGHT_RATIO).toBe(1.25);
  });

  it("places the baseline below the top by ascent plus half-leading", () => {
    expect(BASELINE_RATIO).toBeCloseTo(0.718 + 0.125, 6);
  });
});
