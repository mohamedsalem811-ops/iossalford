/**
 * Receipt output on the device: one PDF made from the receipt's HTML, then printed (AirPrint),
 * shared (WhatsApp, Mail...) or saved in the Files app under On My iPhone / On My iPad → SALFORD
 * POS → Receipts. Nothing goes to iCloud or any server.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { TEMPLATES } from '@/domain/receipts';

import { logoFontCss } from './fonts';
import { PAGE, receiptHtml, type ReceiptDoc } from './templates/html';

/** Room the printer needs at the page edges; the designs' banners start just below it. */
const MARGINS = { top: 18, bottom: 36, left: 0, right: 0 };

/** "SALFORD-Receipt-GR-2026-0007.pdf" */
export function pdfName(doc: Pick<ReceiptDoc, 'receiptNo'>): string {
  const no = (doc.receiptNo ?? 'draft').replace(/[^A-Za-z0-9-]/g, '-');
  return `SALFORD-Receipt-${no}.pdf`;
}

/** Makes the PDF (A4) in the app's cache, named after the receipt number. */
export async function makePdf(doc: ReceiptDoc): Promise<{ file: File; pages: number }> {
  const fontCss = await logoFontCss(TEMPLATES[doc.template].system);
  const r = await Print.printToFileAsync({
    html: receiptHtml(doc, { fontCss }),
    width: PAGE.width,
    height: PAGE.height,
    margins: MARGINS,
  });
  const file = new File(Paths.cache, pdfName(doc));
  if (file.exists) file.delete();
  await new File(r.uri).move(file);
  return { file, pages: r.numberOfPages };
}

/** Opens the AirPrint window with the receipt (the same PDF that is shared). */
export async function printReceipt(doc: ReceiptDoc): Promise<void> {
  const { file } = await makePdf(doc);
  try {
    await Print.printAsync({ uri: file.uri });
  } catch {
    // Closing the print window without printing is not an error for the owner.
  }
}

/** The iOS share sheet with the PDF (WhatsApp, Mail, AirDrop, Save to Files...). */
export async function shareReceipt(doc: ReceiptDoc): Promise<void> {
  const { file } = await makePdf(doc);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: pdfName(doc),
  });
}

/** Keeps a copy in the app's Receipts folder, visible in the Files app. Returns the file name. */
export async function saveReceiptToFiles(doc: ReceiptDoc): Promise<string> {
  const { file } = await makePdf(doc);
  const dir = new Directory(Paths.document, 'Receipts');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, pdfName(doc));
  if (target.exists) target.delete();
  await file.copy(target);
  return target.name;
}
