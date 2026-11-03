"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import { documentRecordSchema, type DocumentRecord } from "@/schemas/document";
import { parseRows } from "@/lib/db/validate";

async function queryDocuments(): Promise<DocumentRecord[]> {
  const rows = await db.documents.orderBy("updatedAt").reverse().toArray();
  return parseRows(rows, documentRecordSchema, "document");
}

/** All documents, newest-first by updatedAt. undefined while loading. */
export function useDocuments(): DocumentRecord[] | undefined {
  return useLiveQuery(queryDocuments);
}
