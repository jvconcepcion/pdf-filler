import { db } from "./db";
import type { Signature } from "@/schemas/signature";

export interface SaveSignatureInput {
  name: string;
  image: Blob;
}

export async function saveSignature(input: SaveSignatureInput): Promise<string> {
  const signature: Signature = {
    id: crypto.randomUUID(),
    name: input.name,
    image: input.image,
    createdAt: Date.now(),
  };
  await db.signatures.add(signature);
  return signature.id;
}

export async function deleteSignature(id: string): Promise<void> {
  await db.signatures.delete(id);
}
