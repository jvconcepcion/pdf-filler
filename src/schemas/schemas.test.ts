import { overlayElementSchema } from "./overlay";
import { documentRecordSchema, fieldValuesSchema } from "./document";
import { signatureSchema } from "./signature";

const UUID = "123e4567-e89b-12d3-a456-426614174000";
const UUID2 = "123e4567-e89b-12d3-a456-426614174999";
const rect = { x: 10, y: 20, width: 100, height: 40 };

function pdfBlob(): Blob {
  return new Blob([new Uint8Array([1, 2, 3])], { type: "application/pdf" });
}

function pngBlob(): Blob {
  return new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
}

describe("overlayElementSchema", () => {
  it("parses a text overlay", () => {
    const el = { id: UUID, kind: "text", pageIndex: 0, rect, text: "hello", fontSize: 12 };
    expect(overlayElementSchema.parse(el)).toEqual(el);
  });

  it("parses a text overlay with optional color", () => {
    const el = { id: UUID, kind: "text", pageIndex: 1, rect, text: "x", fontSize: 10, color: "#ff0000" };
    expect(overlayElementSchema.parse(el).kind).toBe("text");
  });

  it("parses a date overlay", () => {
    const el = { id: UUID, kind: "date", pageIndex: 0, rect, value: "2026-11-03", fontSize: 11 };
    expect(overlayElementSchema.parse(el)).toEqual(el);
  });

  it("parses a checkmark overlay and defaults a pre-17 checkmark to checked", () => {
    const el = { id: UUID, kind: "checkmark", pageIndex: 2, rect };
    expect(overlayElementSchema.parse(el)).toEqual({ ...el, checked: true });
  });

  it("keeps an explicit unchecked auto checkmark", () => {
    const el = { id: UUID, kind: "checkmark", pageIndex: 2, rect, checked: false, source: "auto" as const };
    expect(overlayElementSchema.parse(el)).toEqual(el);
  });

  it("parses a signature overlay", () => {
    const el = { id: UUID, kind: "signature", pageIndex: 0, rect, signatureId: UUID2 };
    expect(overlayElementSchema.parse(el)).toEqual(el);
  });

  it("parses a signature overlay without an attached signature", () => {
    const el = { id: UUID, kind: "signature", pageIndex: 0, rect };
    expect(overlayElementSchema.safeParse(el).success).toBe(true);
  });

  it("rejects an unknown kind", () => {
    const el = { id: UUID, kind: "scribble", pageIndex: 0, rect };
    expect(overlayElementSchema.safeParse(el).success).toBe(false);
  });

  it("rejects a text overlay missing its text", () => {
    const el = { id: UUID, kind: "text", pageIndex: 0, rect, fontSize: 12 };
    expect(overlayElementSchema.safeParse(el).success).toBe(false);
  });

  it("rejects a negative pageIndex", () => {
    const el = { id: UUID, kind: "checkmark", pageIndex: -1, rect };
    expect(overlayElementSchema.safeParse(el).success).toBe(false);
  });

  it("rejects a malformed rect", () => {
    const el = { id: UUID, kind: "checkmark", pageIndex: 0, rect: { x: 0, y: 0, width: -1, height: 10 } };
    expect(overlayElementSchema.safeParse(el).success).toBe(false);
  });
});

describe("fieldValuesSchema", () => {
  it("accepts string and boolean values", () => {
    expect(fieldValuesSchema.parse({ name: "Jane", agree: true })).toEqual({ name: "Jane", agree: true });
  });

  it("rejects non string/boolean values", () => {
    expect(fieldValuesSchema.safeParse({ age: 30 }).success).toBe(false);
  });
});

describe("documentRecordSchema", () => {
  function validRecord() {
    return {
      id: UUID,
      name: "Form.pdf",
      status: "draft" as const,
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
      original: pdfBlob(),
      pageCount: 3,
      overlays: [{ id: UUID2, kind: "checkmark" as const, pageIndex: 0, rect }],
      fieldValues: { fullName: "Jane" },
    };
  }

  it("parses a valid record (thumbnail optional)", () => {
    expect(documentRecordSchema.safeParse(validRecord()).success).toBe(true);
  });

  it("parses a valid record with a thumbnail Blob", () => {
    expect(documentRecordSchema.safeParse({ ...validRecord(), thumbnail: pngBlob() }).success).toBe(true);
  });

  it("rejects an invalid status", () => {
    expect(documentRecordSchema.safeParse({ ...validRecord(), status: "archived" }).success).toBe(false);
  });

  it("rejects a non-Blob original", () => {
    expect(documentRecordSchema.safeParse({ ...validRecord(), original: "not-a-blob" }).success).toBe(false);
  });

  it("rejects a missing original", () => {
    const record = validRecord() as Record<string, unknown>;
    delete record.original;
    expect(documentRecordSchema.safeParse(record).success).toBe(false);
  });

  it("rejects an overlay with a bad kind inside overlays", () => {
    const record = { ...validRecord(), overlays: [{ id: UUID2, kind: "nope", pageIndex: 0, rect }] };
    expect(documentRecordSchema.safeParse(record).success).toBe(false);
  });
});

describe("signatureSchema", () => {
  it("parses a valid signature", () => {
    const sig = { id: UUID, name: "John Hancock", image: pngBlob(), createdAt: 1_700_000_000_000 };
    expect(signatureSchema.safeParse(sig).success).toBe(true);
  });

  it("rejects a non-Blob image", () => {
    const sig = { id: UUID, name: "x", image: "data:...", createdAt: 1 };
    expect(signatureSchema.safeParse(sig).success).toBe(false);
  });
});
