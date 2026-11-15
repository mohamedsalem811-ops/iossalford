import { useState } from 'react';
import { Linking } from 'react-native';

import { Button, Text } from '@/components';
import type { Ctx } from '@/domain/context';
import { waLink } from '@/domain/customer-care';
import { getCustomer } from '@/domain/customers';
import { fill, getMarketing } from '@/domain/marketing';
import { lastMessage, recordMessage } from '@/domain/messages';
import { showError } from '@/features/products/actions';
import { haptic } from '@/lib/haptics';
import { notifyDataChanged } from '@/state/data-events';
import { useCan } from '@/staff/use-can';

/**
 * «رسالة شكر» after a purchase (I4): one WhatsApp message to the sale's customer, whoever she is
 * (it is not an offer), for someone who sees the customers' numbers. Remembered per sale.
 */
export function ThanksButton({
  ctx,
  saleId,
  customerId,
  testID = 'thanks',
}: {
  ctx: Ctx;
  saleId: number;
  customerId: number | null | undefined;
  testID?: string;
}) {
  const phones = useCan('customers.phones');
  const [customer] = useState(() => (customerId ? getCustomer(ctx, customerId) : undefined));
  const [sentAt, setSentAt] = useState(() =>
    customerId ? lastMessage(ctx, customerId, 'thanks', saleId) : null,
  );
  if (!phones || !customer?.phone) return null;
  const send = () => {
    const link = waLink(
      customer.phone,
      fill(getMarketing(ctx).templates.thanks, { الاسم: customer.name }),
    );
    if (!link) return;
    try {
      recordMessage(ctx, { customerId: customer.id, kind: 'thanks', ref: saleId });
    } catch (error) {
      showError(error);
      return;
    }
    haptic.tap();
    notifyDataChanged();
    setSentAt(lastMessage(ctx, customer.id, 'thanks', saleId));
    Linking.openURL(link).catch(() => {});
  };
  return (
    <>
      <Button
        title={sentAt ? 'رسالة شكر مرة أخرى' : 'رسالة شكر (واتساب)'}
        icon="heart.text.square"
        variant="secondary"
        fullWidth
        onPress={send}
        testID={testID}
      />
      {sentAt ? (
        <Text variant="caption" tone="secondary" center testID={`${testID}-sent`}>
          أُرسلت رسالة الشكر لهذه البيعة
        </Text>
      ) : null}
    </>
  );
}
