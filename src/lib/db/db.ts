import Dexie, { type Table } from "dexie";
import type { DocumentRecord } from "@/schemas/document";
import type { Signature } from "@/schemas/signature";

/*
  The single shared Dexie instance. Never instantiate the database anywhere else;
  import `db` from here. Blobs (original PDF, thumbnail, signature PNG) are stored
  directly, never base64.

  Schema is versioned so future shape changes have a migration path. `id` is the
  primary key (we supply a uuid); the other listed fields are secondary indexes.
*/

class PdfFillerDatabase extends Dexie {
  documents!: Table<DocumentRecord, string>;
  signatures!: Table<Signature, string>;

  constructor() {
    super("pdf-filler");
    this.version(1).stores({
      documents: "id, updatedAt, status",
      signatures: "id, createdAt",
    });
  }
}

export const db = new PdfFillerDatabase();
