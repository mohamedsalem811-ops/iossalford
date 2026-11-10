/**
 * Receipt output on the device: a PDF made from the receipt's HTML, A6 for the printer
 * (AirPrint) and A4 to share (WhatsApp, Mail...) or save in the Files app under On My iPhone / On My iPad → SALFORD
 * POS → Receipts. Nothing goes to iCloud or any server.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { TEMPLATES } from '@/domain/receipts';

import { logoFontCss } from './fonts';
import { PAPERS, receiptHtml, type Paper, type ReceiptDoc } from './templates/html';

/** The designs run edge to edge; the printer keeps its own small border on A6. */
const MARGINS = { top: 0, bottom: 0, left: 0, right: 0 };

/** "SALFORD-Receipt-GR-2026-0007.pdf" */
export function pdfName(doc: Pick<ReceiptDoc, 'receiptNo'>): string {
  const no = (doc.receiptNo ?? 'draft').replace(/[^A-Za-z0-9-]/g, '-');
  return `SALFORD-Receipt-${no}.pdf`;
}

/**
 * Makes the PDF in the app's cache, named after the receipt number: A4 to share or keep, A6 for
 * the printer.
 */
export async function makePdf(
  doc: ReceiptDoc,
  paper: Paper = 'a4',
): Promise<{ file: File; pages: number }> {
  const fontCss = await logoFontCss(TEMPLATES[doc.template].system);
  const size = PAPERS[paper];
  const r = await Print.printToFileAsync({
    html: receiptHtml(doc, { paper, fontCss }),
    width: size.width,
    height: size.height,
    margins: MARGINS,
  });
  const name = paper === 'a4' ? pdfName(doc) : pdfName(doc).replace('.pdf', '-A6.pdf');
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  await new File(r.uri).move(file);
  return { file, pages: r.numberOfPages };
}

/** Opens the AirPrint window with the receipt on A6 paper. */
export async function printReceipt(doc: ReceiptDoc): Promise<void> {
  const { file } = await makePdf(doc, 'a6');
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
