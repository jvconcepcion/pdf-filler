import {
  normalizeRotation,
  pdfPointToScreen,
  pdfRectToScreen,
  screenPointToPdf,
  screenRectToPdf,
  screenSizeToPdf,
  pdfSizeToScreen,
  type PageGeometry,
  type Rotation,
} from "./coords";

// US Letter, deliberately non-square so axis swaps are visible.
const W = 612;
const H = 792;

function geom(rotation: Rotation, scale: number): PageGeometry {
  return { pageWidth: W, pageHeight: H, scale, rotation };
}

const ROTATIONS: Rotation[] = [0, 90, 180, 270];
const SCALES = [0.5, 1, 1.5, 3];

describe("normalizeRotation", () => {
  it("snaps and wraps to 0/90/180/270", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(89)).toBe(90);
  });
});

describe("pdfPointToScreen fixed points (hand-computed)", () => {
  const s = 2; // keep arithmetic exact

  // PDF bottom-left (0,0) at each rotation.
  it("maps the PDF origin per rotation", () => {
    expect(pdfPointToScreen({ x: 0, y: 0 }, geom(0, s))).toEqual({ x: 0, y: H * s });
    expect(pdfPointToScreen({ x: 0, y: 0 }, geom(90, s))).toEqual({ x: 0, y: 0 });
    expect(pdfPointToScreen({ x: 0, y: 0 }, geom(180, s))).toEqual({ x: W * s, y: 0 });
    expect(pdfPointToScreen({ x: 0, y: 0 }, geom(270, s))).toEqual({ x: H * s, y: W * s });
  });

  // Which PDF point sits under the screen top-left corner (0,0).
  it("maps the screen top-left corner per rotation", () => {
    expect(screenPointToPdf({ x: 0, y: 0 }, geom(0, s))).toEqual({ x: 0, y: H });
    expect(screenPointToPdf({ x: 0, y: 0 }, geom(90, s))).toEqual({ x: 0, y: 0 });
    expect(screenPointToPdf({ x: 0, y: 0 }, geom(180, s))).toEqual({ x: W, y: 0 });
    expect(screenPointToPdf({ x: 0, y: 0 }, geom(270, s))).toEqual({ x: W, y: H });
  });

  // A known interior point. PDF (100, 700) at rotation 0, scale 2:
  // x = 100*2 = 200; y = (792-700)*2 = 184.
  it("maps a known interior point at rotation 0", () => {
    expect(pdfPointToScreen({ x: 100, y: 700 }, geom(0, s))).toEqual({ x: 200, y: 184 });
  });

  // Same PDF point at rotation 90: x = y*s = 1400; y = x*s = 200.
  it("maps a known interior point at rotation 90", () => {
    expect(pdfPointToScreen({ x: 100, y: 700 }, geom(90, s))).toEqual({ x: 1400, y: 200 });
  });
});

describe("round-trip identity (screen -> pdf -> screen)", () => {
  const screenPoint = { x: 321.4, y: 158.9 };
  for (const rotation of ROTATIONS) {
    for (const scale of SCALES) {
      it(`holds at rotation ${rotation}, scale ${scale}`, () => {
        const g = geom(rotation, scale);
        const pdf = screenPointToPdf(screenPoint, g);
        const back = pdfPointToScreen(pdf, g);
        expect(back.x).toBeCloseTo(screenPoint.x, 9);
        expect(back.y).toBeCloseTo(screenPoint.y, 9);
      });
    }
  }
});

describe("round-trip identity (pdf -> screen -> pdf)", () => {
  const pdfPoint = { x: 275.5, y: 410.25 };
  for (const rotation of ROTATIONS) {
    for (const scale of SCALES) {
      it(`holds at rotation ${rotation}, scale ${scale}`, () => {
        const g = geom(rotation, scale);
        const screen = pdfPointToScreen(pdfPoint, g);
        const back = screenPointToPdf(screen, g);
        expect(back.x).toBeCloseTo(pdfPoint.x, 9);
        expect(back.y).toBeCloseTo(pdfPoint.y, 9);
      });
    }
  }
});

describe("size conversion", () => {
  it("scales magnitudes by the render scale", () => {
    expect(screenSizeToPdf({ width: 150, height: 60 }, 1.5)).toEqual({ width: 100, height: 40 });
    expect(pdfSizeToScreen({ width: 100, height: 40 }, 1.5)).toEqual({ width: 150, height: 60 });
  });

  it("round-trips", () => {
    const px = { width: 123, height: 45 };
    const back = pdfSizeToScreen(screenSizeToPdf(px, 2), 2);
    expect(back.width).toBeCloseTo(px.width, 9);
    expect(back.height).toBeCloseTo(px.height, 9);
  });
});

describe("rect conversion", () => {
  // At rotation 0, scale 2: screen rect (top-left 40,60; 100x80) ->
  // top-left pdf = (20, 792-30=762), bottom-right pdf = (70, 792-70=722)
  // bbox: x=20, y=722, width=50, height=40.
  it("maps a screen rect to PDF space at rotation 0", () => {
    const g = geom(0, 2);
    expect(screenRectToPdf({ x: 40, y: 60, width: 100, height: 80 }, g)).toEqual({
      x: 20,
      y: 722,
      width: 50,
      height: 40,
    });
  });

  it("swaps width/height axes under 90 rotation and round-trips", () => {
    const g = geom(90, 1.5);
    const screenRect = { x: 30, y: 45, width: 120, height: 60 };
    const pdfRect = screenRectToPdf(screenRect, g);
    // Under 90deg the on-screen horizontal extent becomes the PDF vertical extent.
    expect(pdfRect.height).toBeCloseTo(120 / 1.5, 9);
    expect(pdfRect.width).toBeCloseTo(60 / 1.5, 9);

    const back = pdfRectToScreen(pdfRect, g);
    expect(back.x).toBeCloseTo(screenRect.x, 9);
    expect(back.y).toBeCloseTo(screenRect.y, 9);
    expect(back.width).toBeCloseTo(screenRect.width, 9);
    expect(back.height).toBeCloseTo(screenRect.height, 9);
  });

  it("round-trips rects at every rotation", () => {
    const screenRect = { x: 55.5, y: 88.25, width: 140, height: 90 };
    for (const rotation of ROTATIONS) {
      const g = geom(rotation, 1.25);
      const back = pdfRectToScreen(screenRectToPdf(screenRect, g), g);
      expect(back.x).toBeCloseTo(screenRect.x, 9);
      expect(back.y).toBeCloseTo(screenRect.y, 9);
      expect(back.width).toBeCloseTo(screenRect.width, 9);
      expect(back.height).toBeCloseTo(screenRect.height, 9);
    }
  });
});
