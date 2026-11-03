import { z } from "zod";
import { overlayElementSchema } from "./overlay";

// Only the pipeline states we actually use now. Add more here when needed.
export const documentStatusSchema = z.enum(["draft", "ready"]);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

// AcroForm field name -> value. Permissive for now; real field typing lands later.
export const fieldValuesSchema = z.record(z.string(), z.union([z.string(), z.boolean()]));
export type FieldValues = z.infer<typeof fieldValuesSchema>;

export const documentRecordSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: documentStatusSchema,
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  // The untouched original PDF bytes. Written once, never mutated.
  original: z.instanceof(Blob),
  thumbnail: z.instanceof(Blob).optional(),
  pageCount: z.number().int().nonnegative(),
  overlays: z.array(overlayElementSchema),
  fieldValues: fieldValuesSchema,
});

export type DocumentRecord = z.infer<typeof documentRecordSchema>;
