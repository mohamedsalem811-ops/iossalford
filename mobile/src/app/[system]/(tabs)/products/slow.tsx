import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useReducer, useState } from 'react';
import { Alert, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ListGroup,
  ListRow,
  NumberField,
  Page,
  Segmented,
  Text,
} from '@/components';
import { errorBoundary } from '@/components/error-screen';
import { RuleError } from '@/domain/context';
import { setProductPrice, SLOW_DAYS, slowStock, type SlowDays } from '@/domain/slow-stock';
import { bonusPieces, SLOW_BONUS_DAYS } from '@/domain/staff-goals';
import { idleText, slowRowLine } from '@/features/slow-stock/model';
import { productBonusFlow } from '@/features/staff/goal-actions';
import { parseThousandths } from '@/lib/digits';
import { haptic } from '@/lib/haptics';
import { editableDinars, formatLyd } from '@/lib/money';
import { notifyDataChanged, useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { Allowed } from '@/staff/allowed';
import { useCan } from '@/staff/use-can';
import { spacing } from '@/theme';

/**
 * Products → الراكدة (J5), the owner's: pieces in stock with no sale for 60, 90 or 180 days (or
 * never sold since they came in), how long, and the money tied up in them, by brand, the most
 * money first. Tapping a piece opens its price to change (logged).
 */
function SlowStockScreen() {
  const ctx = useCtx();
  const mayPrice = useCan('products.edit');
  const [choice, setChoice] = useState<`${SlowDays}`>('90');
  const days = Number(choice) as SlowDays;
  // Read again on focus and after any change; the days chosen read at once.
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version asks for a fresh read
  const data = useMemo(() => slowStock(ctx, days), [ctx, days, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version asks for a fresh read
  const bonuses = useMemo(() => bonusPieces(ctx), [ctx, version]);
  const bonusOf = new Map(bonuses.map((b) => [b.productId, b.bonus]));
  const bonusFor = (id: number, name: string) =>
    productBonusFlow(ctx, { id, name, bonus: bonusOf.get(id) ?? null }, bump);
  useFocusEffect(useCallback(() => bump(), []));
  useOnDataChanged(bump);
  const [editing, setEditing] = useState<number | null>(null);
  const [price, setPrice] = useState('');

  const open = (id: number, current: number) => {
    if (!mayPrice) return;
    haptic.tap();
    setEditing((e) => (e === id ? null : id));
    setPrice(editableDinars(current));
  };
  const save = (id: number) => {
    const value = parseThousandths(price);
    try {
      setProductPrice(ctx, id, value ?? 0);
      haptic.success();
      setEditing(null);
      notifyDataChanged();
    } catch (error) {
      haptic.error();
      Alert.alert(
        'لم يتغير السعر',
        error instanceof RuleError ? error.message : 'حدث خطأ غير متوقع، لم يتغير شيء.',
      );
    }
  };

  return (
    <>
      <Stack.Title>الراكدة</Stack.Title>
      <Page keyboard>
        <Segmented<`${SlowDays}`>
          options={SLOW_DAYS.map((d) => ({ value: `${d}` as const, label: `${d} يوماً` }))}
          value={choice}
          onChange={setChoice}
          testID="slow-days"
        />
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="body">المال المجمّد</Text>
            <Text variant="headline" tone="accent" testID="slow-total">
              {formatLyd(data.total.tiedUp)}
            </Text>
          </View>
          <Text variant="caption" tone="secondary">
            {`${data.total.items} صنف • ${data.total.pieces} قطعة بلا بيع منذ ${days} يوماً أو أكثر (بسعر التكلفة)`}
          </Text>
        </Card>

        {bonuses.length ? (
          <ListGroup
            header="قطع عليها مكافأة للموظف"
            footer="يكسبها الموظف عن كل قطعة يبيعها، وتُخصم إن أُرجعت. اضغط القطعة لتغيير المبلغ أو إيقافها.">
            {bonuses.map((b) => (
              <ListRow
                key={b.productId}
                icon="gift"
                title={b.size ? `${b.name} (${b.size})` : b.name}
                subtitle={`${b.stock} قطعة في المخزون`}
                value={formatLyd(b.bonus)}
                onPress={mayPrice ? () => bonusFor(b.productId, b.name) : undefined}
                testID={`bonus-row-${b.productId}`}
              />
            ))}
          </ListGroup>
        ) : null}

        {data.rows.length ? (
          <>
            <Text variant="subhead" tone="secondary">
              حسب الماركة
            </Text>
            <ListGroup>
              {data.brands.map((b) => (
                <ListRow
                  key={b.brand}
                  title={b.brand}
                  subtitle={`${b.items} صنف • ${b.pieces} قطعة`}
                  value={formatLyd(b.tiedUp)}
                  testID={`slow-brand-${b.brand}`}
                />
              ))}
            </ListGroup>
            <Text variant="subhead" tone="secondary">
              القطع
            </Text>
            <ListGroup>
              {data.rows.map((r) => (
                <View key={r.productId}>
                  <ListRow
                    title={r.size ? `${r.name} (${r.size})` : r.name}
                    subtitle={[
                      idleText(r),
                      slowRowLine(r),
                      bonusOf.has(r.productId)
                        ? `مكافأة ${formatLyd(bonusOf.get(r.productId)!)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                    value={formatLyd(r.tiedUp)}
                    onPress={mayPrice ? () => open(r.productId, r.price) : undefined}
                    testID={`slow-row-${r.productId}`}
                  />
                  {editing === r.productId ? (
                    <View style={{ padding: spacing.md, gap: spacing.sm }}>
                      <NumberField
                        label={`سعر البيع الجديد (الآن ${formatLyd(r.price)}، التكلفة ${formatLyd(r.cost)})`}
                        value={price}
                        onChangeText={setPrice}
                        suffix="د.ل"
                        testID="slow-price"
                      />
                      <Button
                        title="حفظ السعر"
                        icon="checkmark.circle.fill"
                        fullWidth
                        onPress={() => save(r.productId)}
                        testID="slow-price-save"
                      />
                      {r.days >= SLOW_BONUS_DAYS ? (
                        <Button
                          title={
                            bonusOf.has(r.productId)
                              ? 'تغيير مكافأة الموظف'
                              : 'مكافأة للموظف على كل قطعة تُباع'
                          }
                          icon="gift"
                          variant="secondary"
                          fullWidth
                          onPress={() => bonusFor(r.productId, r.name)}
                          testID="slow-bonus"
                        />
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ))}
            </ListGroup>
          </>
        ) : (
          <EmptyState
            icon="checkmark.seal"
            title="لا قطع راكدة"
            message={`كل القطع المتوفرة بيع منها شيء خلال ${days} يوماً`}
          />
        )}
      </Page>
    </>
  );
}

export default function SlowStockRoute() {
  return (
    <Allowed permission="costs.view" title="الراكدة">
      <SlowStockScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('products/slow');
