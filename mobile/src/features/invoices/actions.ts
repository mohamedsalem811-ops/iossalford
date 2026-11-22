/**
 * The original invoices on the device (jewelry): the owner adds one (a photo of the gift receipt
 * or its PDF) to the private folder; anyone opens one (an employee with the invoice code) to show
 * and print it. There is no share and no save: the file never leaves the app except to the printer.
 */
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import { ActionSheetIOS, Alert } from 'react-native';

import { RuleError, type Ctx } from '@/domain/context';
import {
  addOriginalInvoice,
  InvoiceCodeNeeded,
  newInvoiceName,
  openOriginalInvoice,
  removeOriginalInvoice,
  type InvoiceKind,
} from '@/domain/original-invoices';
import { haptic } from '@/lib/haptics';
import { deletePhotoFile, pickPhoto, type PhotoSource } from '@/lib/photos';
import { photoFile, photoFolder } from '@/lib/storage';
import { askCode } from '@/staff/approvals';
import { notifyDataChanged } from '@/state/data-events';

const random = () => Crypto.randomUUID().replace(/-/g, '');

const failed = (title: string, error: unknown) => {
  haptic.error();
  Alert.alert(title, error instanceof RuleError ? error.message : 'حدث خطأ غير متوقع.');
};

/** Asks how to add it: a photo now, a photo from the library, or a PDF file. */
const chooseSource = () =>
  new Promise<PhotoSource | 'pdf' | null>((resolve) =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'الفاتورة الأصلية',
        message: 'إيصال الهدية بعد إخفاء الأسعار',
        options: ['تصوير الفاتورة', 'اختيار صورة', 'ملف PDF', 'إلغاء'],
        cancelButtonIndex: 3,
      },
      (i) => resolve((['camera', 'library', 'pdf'] as const)[i] ?? null),
    ),
  );

/** Saves the chosen file in the private folder; its name, or null. */
async function saveFile(
  ctx: Ctx,
  source: PhotoSource | 'pdf',
): Promise<{ file: string; kind: InvoiceKind } | null> {
  if (source === 'pdf') {
    const r = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (r.canceled || !r.assets?.length) return null;
    const file = newInvoiceName('pdf', random());
    new File(r.assets[0].uri).copy(new File(photoFolder(ctx.system), file));
    return { file, kind: 'pdf' };
  }
  const r = await pickPhoto(ctx.system, source, newInvoiceName('image', random()));
  if (r.status === 'denied') {
    Alert.alert('الكاميرا', r.message);
    return null;
  }
  return r.status === 'picked' ? { file: r.file, kind: 'image' } : null;
}

/** The owner adds an invoice to a piece. Returns true when added. */
export async function addInvoiceFlow(
  ctx: Ctx,
  productId: number,
  title?: string,
): Promise<boolean> {
  const source = await chooseSource();
  if (!source) return false;
  let saved: { file: string; kind: InvoiceKind } | null = null;
  try {
    saved = await saveFile(ctx, source);
    if (!saved) return false;
    addOriginalInvoice(ctx, { ...saved, title, productIds: [productId] });
  } catch (error) {
    if (saved) deletePhotoFile(ctx.system, saved.file);
    failed('لم تُحفظ الفاتورة', error);
    return false;
  }
  haptic.success();
  notifyDataChanged();
  return true;
}

/** The owner removes an invoice, and its file. */
export function removeInvoiceFlow(ctx: Ctx, id: number, onDone: () => void) {
  Alert.alert('حذف الفاتورة الأصلية؟', 'تُحذف من كل القطع المرتبطة بها.', [
    { text: 'إلغاء', style: 'cancel' },
    {
      text: 'حذف',
      style: 'destructive',
      onPress: () => {
        try {
          deletePhotoFile(ctx.system, removeOriginalInvoice(ctx, id));
        } catch (error) {
          failed('لم تُحذف', error);
          return;
        }
        haptic.success();
        notifyDataChanged();
        onDone();
      },
    },
  ]);
}

export type OpenedInvoice = { uri: string; kind: InvoiceKind };

/**
 * Opens an invoice to show it: an employee types the owner's invoice code first. Logged (and an
 * alert for the owner) by the domain. Null when not opened.
 */
export async function openInvoiceFlow(
  ctx: Ctx,
  id: number,
  productId: number,
  pieceName: string,
): Promise<OpenedInvoice | null> {
  let approval: string | undefined;
  if (ctx.actor?.kind !== 'owner') {
    approval = (await askCode(ctx, 'invoice', `الفاتورة الأصلية لـ «${pieceName}»`)) ?? undefined;
    if (!approval) return null;
  }
  try {
    const r = openOriginalInvoice(ctx, id, { approval, productId });
    const f = photoFile(ctx.system, r.file);
    if (!f.exists) throw new RuleError('ملف الفاتورة غير موجود على هذا الجهاز');
    notifyDataChanged();
    return { uri: f.uri, kind: r.kind };
  } catch (error) {
    if (error instanceof InvoiceCodeNeeded) Alert.alert('الفاتورة الأصلية', error.message);
    else failed('لم تُفتح الفاتورة', error);
    return null;
  }
}

/** The page printed for a photo of an invoice: the photo fitted on A4, nothing else. */
export function invoicePageHtml(dataUri: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 10mm; }
  html, body { margin: 0; height: 100%; }
  .p { height: 277mm; display: flex; align-items: center; justify-content: center; }
  img { max-width: 100%; max-height: 100%; object-fit: contain; }
</style></head><body><div class="p"><img src="${dataUri}" alt=""></div></body></html>`;
}

/** Prints an opened invoice: a PDF as it is, a photo fitted on an A4 page. */
export async function printInvoice(opened: OpenedInvoice) {
  try {
    if (opened.kind === 'pdf') await Print.printAsync({ uri: opened.uri });
    else {
      const base64 = await new File(opened.uri).base64();
      await Print.printAsync({ html: invoicePageHtml(`data:image/jpeg;base64,${base64}`) });
    }
  } catch (error) {
    // Closing the print window is not an error.
    if (error instanceof Error && /cancel/i.test(error.message)) return;
    failed('لم تتم الطباعة', error);
  }
}
