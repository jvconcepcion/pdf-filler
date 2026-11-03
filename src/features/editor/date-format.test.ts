import { isoToDisplay, displayToIso } from "./date-format";

describe("isoToDisplay", () => {
  it("formats ISO to mm/dd/yyyy", () => {
    expect(isoToDisplay("2026-11-03")).toBe("11/03/2026");
  });
  it("returns empty for invalid input", () => {
    expect(isoToDisplay("")).toBe("");
    expect(isoToDisplay("11/03/2026")).toBe("");
    expect(isoToDisplay("2026-11")).toBe("");
  });
});

describe("displayToIso", () => {
  it("parses mm/dd/yyyy to ISO", () => {
    expect(displayToIso("11/03/2026")).toBe("2026-11-03");
  });
  it("returns empty for invalid input", () => {
    expect(displayToIso("")).toBe("");
    expect(displayToIso("2026-11-03")).toBe("");
  });
});

describe("round trip", () => {
  it("ISO -> display -> ISO is stable", () => {
    expect(displayToIso(isoToDisplay("2026-01-09"))).toBe("2026-01-09");
  });
});
