"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import { documentRecordSchema, type DocumentRecord } from "@/schemas/document";
import { parseRow } from "@/lib/db/validate";

/**
 * One document by id.
 * undefined while loading, null when missing or invalid.
 */
export function useDocument(id: string | undefined): DocumentRecord | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    const row = await db.documents.get(id);
    if (!row) return null;
    return parseRow(row, documentRecordSchema, "document");
  }, [id]);
}
