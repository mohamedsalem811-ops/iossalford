/**
 * The repair ticket (new design) on the device: one A4 PDF, printed through AirPrint or shared
 * (WhatsApp, Mail, AirDrop...). The first photo of the piece is embedded in the page. Nothing goes
 * to iCloud or any server.
 */
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { photoFile } from '@/lib/storage';
import type { SystemId } from '@/theme';

import { cardFontCss } from './fonts';
import { PAGE } from './templates/html';
import { repairTicketHtml, type RepairTicket } from './templates/repair-ticket';

const MARGINS = { top: 0, bottom: 0, left: 0, right: 0 };

/** "SALFORD-Repair-R-2026-0042.pdf" */
export const ticketPdfName = (t: Pick<RepairTicket, 'ticketNo'>) =>
  `SALFORD-Repair-${t.ticketNo.replace(/[^A-Za-z0-9-]/g, '-')}.pdf`;

/** The piece's first photo as a data URI the page can show; null when there is none. */
export async function ticketPhoto(system: SystemId, name: string | undefined) {
  if (!name) return null;
  try {
    const f = photoFile(system, name);
    if (!f.exists) return null;
    return `data:image/jpeg;base64,${await f.base64()}`;
  } catch {
    return null;
  }
}

async function makeTicketPdf(t: RepairTicket): Promise<File> {
  const fontCss = await cardFontCss(t.system);
  const r = await Print.printToFileAsync({
    html: repairTicketHtml(t, { fontCss }),
    width: PAGE.width,
    height: PAGE.height,
    margins: MARGINS,
  });
  const file = new File(Paths.cache, ticketPdfName(t));
  if (file.exists) file.delete();
  await new File(r.uri).move(file);
  return file;
}

/** The AirPrint window with the ticket on A4. */
export async function printTicket(t: RepairTicket): Promise<void> {
  const file = await makeTicketPdf(t);
  try {
    await Print.printAsync({ uri: file.uri });
  } catch {
    // Closing the print window without printing is not an error.
  }
}

/** The iOS share sheet with the ticket's PDF. */
export async function shareTicket(t: RepairTicket): Promise<void> {
  const file = await makeTicketPdf(t);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: ticketPdfName(t),
  });
}
