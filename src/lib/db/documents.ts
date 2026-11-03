import { db } from "./db";
import type { DocumentRecord } from "@/schemas/document";

export interface CreateDocumentInput {
  name: string;
  /** The untouched original PDF bytes, stored once. */
  original: Blob;
  pageCount: number;
  thumbnail?: Blob;
}

export async function createDocument(input: CreateDocumentInput): Promise<string> {
  const now = Date.now();
  const record: DocumentRecord = {
    id: crypto.randomUUID(),
    name: input.name,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    original: input.original,
    thumbnail: input.thumbnail,
    pageCount: input.pageCount,
    overlays: [],
    fieldValues: {},
  };
  await db.documents.add(record);
  return record.id;
}

/*
  The only fields an update may touch. `original`, `id`, `createdAt` and
  `pageCount` are intentionally excluded, so the type itself makes it impossible
  to overwrite the original bytes. This is the non-destructive guarantee.
*/
export type DocumentUpdate = Partial<
  Pick<DocumentRecord, "name" | "status" | "overlays" | "fieldValues" | "thumbnail">
>;

export async function updateDocument(id: string, changes: DocumentUpdate): Promise<void> {
  await db.documents.update(id, { ...changes, updatedAt: Date.now() });
}

export async function renameDocument(id: string, name: string): Promise<void> {
  await updateDocument(id, { name });
}

export async function deleteDocument(id: string): Promise<void> {
  await db.documents.delete(id);
}
