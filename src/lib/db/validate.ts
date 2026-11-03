import type { ZodType } from "zod";

/*
  Validate rows on read. Data in IndexedDB may have been written by an older app
  version, so a row that no longer matches its schema is skipped and warned, not
  thrown. One bad record must never blank the whole dashboard.
*/

export function parseRows<T>(rows: unknown[], schema: ZodType<T>, label: string): T[] {
  const valid: T[] = [];
  for (const row of rows) {
    const result = schema.safeParse(row);
    if (result.success) {
      valid.push(result.data);
      continue;
    }
    console.warn(`Skipping invalid ${label} row on read`, result.error.issues);
  }
  return valid;
}

export function parseRow<T>(row: unknown, schema: ZodType<T>, label: string): T | null {
  const result = schema.safeParse(row);
  if (result.success) return result.data;
  console.warn(`Skipping invalid ${label} row on read`, result.error.issues);
  return null;
}
