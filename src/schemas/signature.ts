import { z } from "zod";

export const signatureSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  image: z.instanceof(Blob),
  createdAt: z.number().int(),
});

export type Signature = z.infer<typeof signatureSchema>;
