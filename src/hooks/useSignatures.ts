"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import { signatureSchema, type Signature } from "@/schemas/signature";
import { parseRows } from "@/lib/db/validate";

async function querySignatures(): Promise<Signature[]> {
  const rows = await db.signatures.orderBy("createdAt").reverse().toArray();
  return parseRows(rows, signatureSchema, "signature");
}

/** All saved signatures, newest-first by createdAt. undefined while loading. */
export function useSignatures(): Signature[] | undefined {
  return useLiveQuery(querySignatures);
}
