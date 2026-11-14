/**
 * The rewards card as a PDF on the device (H3): A6 for the shop's printer (AirPrint), and the
 * print shop's file (3 mm bleed and crop marks) to share or keep in the Files app under On My
 * iPhone / On My iPad → SALFORD POS → Receipts. Nothing goes to iCloud or any server.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { cardFontCss } from './fonts';
import { cardPage, rewardCardHtml, type CardInput } from './reward-card';

const MARGINS = { top: 0, bottom: 0, left: 0, right: 0 };

/** "SALFORD-Rewards-Card-jewelry-print-shop.pdf" */
export const cardPdfName = (input: Pick<CardInput, 'system'>, mode: 'a6' | 'press') =>
  `SALFORD-Rewards-Card-${input.system}${mode === 'press' ? '-print-shop' : '-A6'}.pdf`;

/** Makes the card's PDF (front, then back) in the app's cache. */
export async function makeCardPdf(input: CardInput, mode: 'a6' | 'press'): Promise<File> {
  const fontCss = await cardFontCss(input.system);
  const r = await Print.printToFileAsync({
    html: rewardCardHtml(input, { mode, fontCss }),
    ...cardPage(mode),
    margins: MARGINS,
  });
  const file = new File(Paths.cache, cardPdfName(input, mode));
  if (file.exists) file.delete();
  await new File(r.uri).move(file);
  return file;
}

/**
 * A test print on the shop's printer: the AirPrint window with the card on A6. True when it was
 * printed; false when the window was closed without printing (not an error for the owner).
 */
export async function printCard(input: CardInput): Promise<boolean> {
  const file = await makeCardPdf(input, 'a6');
  try {
    await Print.printAsync({ uri: file.uri });
    return true;
  } catch {
    return false;
  }
}

/**
 * The print shop's file in the iOS share sheet (WhatsApp, Mail, AirDrop...). iOS reports the
 * sheet closing the same way whether the file was sent or not.
 */
export async function shareCard(input: CardInput): Promise<void> {
  const file = await makeCardPdf(input, 'press');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: cardPdfName(input, 'press'),
  });
}

/** Keeps the print shop's file in the app's Receipts folder, seen in the Files app. */
export async function saveCardToFiles(input: CardInput): Promise<string> {
  const file = await makeCardPdf(input, 'press');
  const dir = new Directory(Paths.document, 'Receipts');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, cardPdfName(input, 'press'));
  if (target.exists) target.delete();
  await file.copy(target);
  return target.name;
}
