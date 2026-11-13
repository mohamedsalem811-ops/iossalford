import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';

import { Card, EmptyState, ListGroup, ListRow, Page, Text } from '@/components';
import { errorBoundary } from '@/components/error-screen';
import { getReturn } from '@/domain/sales';
import { returnCharge } from '@/domain/staff-ledger';
import { formatDate, formatTime } from '@/lib/dates';
import { photoUri } from '@/lib/photos';
import { formatLyd } from '@/lib/money';
import { useCtx } from '@/state/system-db';
import { Allowed } from '@/staff/allowed';
import { radius } from '@/theme';

/** A return as it was taken (phase S4): the photo, the conditions answered, who and why. */
function ReturnDetail() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = getReturn(ctx, Number(id));
  if (!r) return <EmptyState icon="arrow.uturn.backward" title="المرتجع غير موجود" />;
  const charge = returnCharge(ctx, r.id);
  return (
    <>
      <Stack.Screen options={{ title: `مرتجع رقم ${r.id}` }} />
      <Page>
        {r.photo ? (
          <Image
            source={{ uri: photoUri(ctx.system, r.photo) }}
            style={{ width: '100%', aspectRatio: 1, borderRadius: radius.lg }}
            contentFit="cover"
            accessibilityLabel={`صورة ${r.name} المرتجعة`}
            testID="return-detail-photo"
          />
        ) : (
          <Card>
            <Text variant="subhead" tone="secondary">
              لا توجد صورة (مرتجع قبل اشتراط الصورة)
            </Text>
          </Card>
        )}
        <ListGroup header={`${r.name} × ${r.quantity}`}>
          <ListRow title="الاسترداد" value={formatLyd(r.refund)} chevron={false} />
          <ListRow
            title="أخذه"
            value={`${r.byName} • ${formatDate(new Date(r.createdAt))} ${formatTime(new Date(r.createdAt))}`}
            chevron={false}
          />
          {r.reason ? <ListRow title="السبب" value={r.reason} chevron={false} /> : null}
          {r.overrideReason ? (
            <ListRow title="بموافقة المالك" value={r.overrideReason} chevron={false} />
          ) : null}
          {r.exchangeSaleId ? (
            <ListRow title="استبدال" value={`البيعة رقم ${r.exchangeSaleId}`} chevron={false} />
          ) : null}
          {charge ? (
            <ListRow
              title="على حساب"
              value={`${charge.employeeName} • ${formatLyd(charge.amount)}`}
              chevron={false}
              testID="return-detail-charge"
            />
          ) : null}
        </ListGroup>
        {r.conditions ? (
          <ListGroup header="الشروط">
            {Object.entries(r.conditions).map(([c, ok]) => (
              <ListRow key={c} title={c} value={ok ? 'نعم' : 'لا'} chevron={false} />
            ))}
          </ListGroup>
        ) : null}
      </Page>
    </>
  );
}

/** The owner's view of returns (`sales.viewAll`). */
export default function ReturnDetailRoute() {
  return (
    <Allowed permission="sales.viewAll" title="المرتجع">
      <ReturnDetail />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('return-detail/[id]');
