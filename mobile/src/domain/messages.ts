/**
 * The WhatsApp messages the app opened for a customer (I2, I4). The app can't send them: it opens
 * WhatsApp with the message ready and the person sends it. Each one is remembered (its kind and
 * what it was about), so the same message is not offered twice by mistake.
 */
import { logAction } from './activity';
import { allow, nowStamp, type Ctx, who } from './context';
import { getCustomer } from './customers';

/** What a message was for: an order's expected date or arrival (I2), and marketing (I4). */
export type MessageKind =
  | 'order-eta'
  | 'order-arrived'
  | 'order-waiting'
  | 'thanks'
  | 'occasion'
  | 'vip'
  | 'miss-you'
  | 'gift'
  | 'repair-ready';

export const MESSAGE_LABELS: Record<MessageKind, string> = {
  'order-eta': 'موعد وصول الطلب',
  'order-arrived': 'وصول الطلب',
  'order-waiting': 'تذكير باستلام الطلب',
  thanks: 'شكراً بعد الشراء',
  occasion: 'مناسبة',
  vip: 'VIP: أول من يرى',
  'miss-you': 'نفتقدك',
  gift: 'تذكير هدية',
  'repair-ready': 'الصيانة جاهزة',
};

/** Remembers that a message was opened in WhatsApp for this customer. */
export function recordMessage(
  ctx: Ctx,
  input: { customerId: number; kind: MessageKind; ref?: string | number },
): number {
  // Only someone who sees the customers' numbers is offered WhatsApp (feature 26).
  allow(ctx, 'customers.phones');
  return ctx.db.transaction(() => {
    const c = getCustomer(ctx, input.customerId);
    const ref = input.ref === undefined ? null : String(input.ref);
    const id = ctx.db.run(
      'INSERT INTO message_log (customer_id, kind, ref, created_at, by, by_name) VALUES (?, ?, ?, ?, ?, ?)',
      [input.customerId, input.kind, ref, nowStamp(ctx), ...who(ctx)],
    ).lastInsertRowId;
    logAction(
      ctx,
      'message.open',
      `رسالة واتساب «${MESSAGE_LABELS[input.kind]}» لـ «${c?.name ?? '—'}»`,
      { messageId: id, customerId: input.customerId, kind: input.kind, ...(ref ? { ref } : {}) },
    );
    return id;
  });
}

/** When this message was last opened for the customer, or null. */
export function lastMessage(
  ctx: Ctx,
  customerId: number,
  kind: MessageKind,
  ref?: string | number,
): string | null {
  return (
    ctx.db.get<{ at: string }>(
      `SELECT created_at at FROM message_log WHERE customer_id = ? AND kind = ? AND ref IS ?
        ORDER BY id DESC LIMIT 1`,
      [customerId, kind, ref === undefined ? null : String(ref)],
    )?.at ?? null
  );
}
