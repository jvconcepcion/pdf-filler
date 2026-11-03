"use client";

import {
  PDFDocument,
  StandardFonts,
  LineCapStyle,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFTextField,
  degrees,
  rgb,
  type Color,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { db } from "@/lib/db/db";
import {
  normalizeRotation,
  pdfRectToScreen,
  screenPointToPdf,
  type PageGeometry,
  type Rect,
} from "@/lib/pdf/coords";
import {
  BASELINE_RATIO,
  LINE_HEIGHT_RATIO,
  alignedTextX,
  buildExportFilename,
  checkPolyline,
  checkThickness,
  containRect,
  elementProducesOutput,
  type TextAlign,
} from "@/lib/pdf/export-helpers";
import type { DocumentRecord, FieldValues } from "@/schemas/document";

/*
  Client-side export. Reads the stored original bytes with pdf-lib (a read; the
  stored document is never mutated), draws the overlays onto an in-memory copy,
  applies any AcroForm field values, flattens, and downloads a finished PDF.

  Why placement matches the screen: overlays are stored in PDF points
  (bottom-left origin) by coords.ts, and Helvetica here matches the font-overlay
  the editor renders in. Each element is laid out in "display space" (the upright
  on-screen view, at scale 1) exactly as the editor lays it out, then its anchor
  points are mapped into pdf-lib user space by coords.ts and drawn rotated by the
  page rotation so content lands in the same spot and reads upright.
*/

const BLACK = rgb(0, 0, 0);

export async function exportDocument(doc: DocumentRecord): Promise<void> {
  const bytes = await doc.original.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  // Embed each referenced signature once; null marks an id that no longer resolves.
  const signatureCache = new Map<string, PDFImage | null>();

  for (const element of doc.overlays) {
    const page = pages[element.pageIndex];
    if (!page) continue;
    // Unchecked boxes and empty fields draw nothing; the printed form shows through.
    if (!elementProducesOutput(element)) continue;

    const geom = pageGeometry(page);
    const displayRect = pdfRectToScreen(element.rect, geom);

    if (element.kind === "text") {
      drawTextBlock(page, font, geom, displayRect, element.text.split("\n"), element.fontSize, element.align ?? "left", toColor(element.color));
      continue;
    }
    if (element.kind === "date") {
      drawTextBlock(page, font, geom, displayRect, [element.value], element.fontSize, "left", BLACK);
      continue;
    }
    if (element.kind === "checkmark") {
      drawCheck(page, geom, displayRect);
      continue;
    }
    await drawSignature(pdfDoc, page, geom, displayRect, element.signatureId, signatureCache);
  }

  applyFieldValues(pdfDoc, doc.fieldValues);

  const out = await pdfDoc.save();
  downloadBytes(out, buildExportFilename(doc.name));
}

function pageGeometry(page: PDFPage): PageGeometry {
  const { width, height } = page.getSize();
  return {
    pageWidth: width,
    pageHeight: height,
    scale: 1,
    rotation: normalizeRotation(page.getRotation().angle),
  };
}

function drawTextBlock(
  page: PDFPage,
  font: PDFFont,
  geom: PageGeometry,
  displayRect: Rect,
  lines: string[],
  fontSize: number,
  align: TextAlign,
  color: Color,
) {
  lines.forEach((line, i) => {
    if (!line) return;
    let textWidth: number;
    try {
      textWidth = font.widthOfTextAtSize(line, fontSize);
    } catch (error) {
      throw encodingError(error);
    }
    const dx = alignedTextX(displayRect.x, displayRect.width, textWidth, align);
    const baselineY = displayRect.y + i * fontSize * LINE_HEIGHT_RATIO + fontSize * BASELINE_RATIO;
    const anchor = screenPointToPdf({ x: dx, y: baselineY }, geom);
    try {
      page.drawText(line, {
        x: anchor.x,
        y: anchor.y,
        size: fontSize,
        font,
        color,
        rotate: degrees(geom.rotation),
      });
    } catch (error) {
      throw encodingError(error);
    }
  });
}

function drawCheck(page: PDFPage, geom: PageGeometry, displayRect: Rect) {
  const [a, b, c] = checkPolyline(displayRect);
  const ua = screenPointToPdf(a, geom);
  const ub = screenPointToPdf(b, geom);
  const uc = screenPointToPdf(c, geom);
  const thickness = checkThickness(displayRect);
  page.drawLine({ start: ua, end: ub, thickness, color: BLACK, lineCap: LineCapStyle.Round });
  page.drawLine({ start: ub, end: uc, thickness, color: BLACK, lineCap: LineCapStyle.Round });
}

async function drawSignature(
  pdfDoc: PDFDocument,
  page: PDFPage,
  geom: PageGeometry,
  displayRect: Rect,
  signatureId: string | undefined,
  cache: Map<string, PDFImage | null>,
) {
  if (!signatureId) return;

  let image = cache.get(signatureId);
  if (image === undefined) {
    const signature = await db.signatures.get(signatureId);
    if (!signature) {
      cache.set(signatureId, null);
      return;
    }
    image = await pdfDoc.embedPng(await signature.image.arrayBuffer());
    cache.set(signatureId, image);
  }
  if (!image) return;

  const inner = containRect(
    { width: displayRect.width, height: displayRect.height },
    { width: image.width, height: image.height },
  );
  const dx = displayRect.x + inner.x;
  const dyTop = displayRect.y + inner.y;
  // pdf-lib anchors an image at its lower-left corner; in display space that is
  // the bottom-left of the fitted box (top + height).
  const lowerLeft = screenPointToPdf({ x: dx, y: dyTop + inner.height }, geom);
  page.drawImage(image, {
    x: lowerLeft.x,
    y: lowerLeft.y,
    width: inner.width,
    height: inner.height,
    rotate: degrees(geom.rotation),
  });
}

function applyFieldValues(pdfDoc: PDFDocument, fieldValues: FieldValues) {
  const entries = Object.entries(fieldValues);
  if (entries.length === 0) return;

  const form = pdfDoc.getForm();
  let applied = 0;
  for (const [name, value] of entries) {
    const field = form.getFieldMaybe(name);
    if (!field) continue;
    try {
      if (field instanceof PDFTextField) {
        field.setText(typeof value === "boolean" ? (value ? "Yes" : "") : value);
        applied++;
      } else if (field instanceof PDFCheckBox) {
        if (value) field.check();
        else field.uncheck();
        applied++;
      } else if (field instanceof PDFDropdown && typeof value === "string") {
        field.select(value);
        applied++;
      } else if (field instanceof PDFRadioGroup && typeof value === "string") {
        field.select(value);
        applied++;
      }
    } catch (error) {
      console.warn(`Could not set field "${name}"`, error);
    }
  }
  // Flatten only when fields were actually set, so untouched PDFs are left alone.
  if (applied > 0) form.flatten();
}

function toColor(hex: string | undefined): Color {
  if (!hex) return BLACK;
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return BLACK;
  const n = Number.parseInt(match[1], 16);
  return rgb(((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255);
}

function encodingError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/encode/i.test(message)) {
    return new Error(
      `Export failed: the text contains a character the built-in Helvetica font cannot write (${message}). Remove it and export again.`,
    );
  }
  return error instanceof Error ? error : new Error(message);
}

function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
