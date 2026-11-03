import { z } from "zod";

/*
  Overlay elements are stored in PDF point space (bottom-left origin), exactly
  the rect shape coords.ts produces, so they re-render correctly at any zoom and
  after reopen. Only the fields each kind needs to be stored and re-drawn live
  here. Styling options no tool produces yet (font family, rotation, opacity)
  are added later, in this file, when a tool actually needs them.
*/

export const rectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
});

export type Rect = z.infer<typeof rectSchema>;

const overlayBase = {
  id: z.uuid(),
  pageIndex: z.number().int().nonnegative(),
  rect: rectSchema,
  // Marks elements placed by auto field detection (prompt 17). Undefined means
  // the user placed it by hand; a re-run of detection only replaces the "auto" set.
  source: z.literal("auto").optional(),
};

const textOverlaySchema = z.object({
  ...overlayBase,
  kind: z.literal("text"),
  text: z.string(),
  fontSize: z.number().positive(),
  // Undefined renders as left-aligned.
  align: z.enum(["left", "center", "right"]).optional(),
  // Undefined renders as black.
  color: z.string().optional(),
});

const dateOverlaySchema = z.object({
  ...overlayBase,
  kind: z.literal("date"),
  value: z.string(),
  fontSize: z.number().positive(),
});

const checkmarkOverlaySchema = z.object({
  ...overlayBase,
  kind: z.literal("checkmark"),
  // Whether the check is drawn. Manual checkmarks (prompt 13) and any pre-17
  // stored checkmark default to true; auto-detected boxes start false (an empty
  // box the user can click to toggle).
  checked: z.boolean().default(true),
});

const signatureOverlaySchema = z.object({
  ...overlayBase,
  kind: z.literal("signature"),
  // Optional: a signature can be placed before one is attached (prompt 14).
  signatureId: z.uuid().optional(),
});

export const overlayElementSchema = z.discriminatedUnion("kind", [
  textOverlaySchema,
  dateOverlaySchema,
  checkmarkOverlaySchema,
  signatureOverlaySchema,
]);

export type OverlayElement = z.infer<typeof overlayElementSchema>;
export type OverlayKind = OverlayElement["kind"];
