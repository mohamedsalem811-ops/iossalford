import { useState } from 'react';
import { ActionSheetIOS, Alert, View } from 'react-native';

import { Button, ListGroup, ListRow, Text } from '@/components';
import { RuleError, type Ctx } from '@/domain/context';
import {
  listRepairServices,
  removeRepairService,
  saveRepairService,
  servicePriceText,
  type RepairService,
} from '@/domain/repair-services';
import { parseThousandths } from '@/lib/digits';
import { haptic } from '@/lib/haptics';
import { editableDinars } from '@/lib/money';
import { notifyDataChanged } from '@/state/data-events';
import { spacing } from '@/theme';

const ask = (title: string, message: string, value: string, keyboard: 'default' | 'decimal-pad') =>
  new Promise<string | null>((resolve) =>
    Alert.prompt(
      title,
      message,
      [
        { text: 'إلغاء', style: 'cancel', onPress: () => resolve(null) },
        { text: 'التالي', onPress: (v?: string) => resolve(v ?? '') },
      ],
      'plain-text',
      value,
      keyboard,
    ),
  );

/**
 * The owner's repair services and prices (rule D), in «قواعد المحل»: staff tick them on a new
 * repair and never type a price. A price left empty is «السعر يحدده المالك»: the owner prices it
 * on each repair.
 */
export function RepairServicesCard({ ctx }: { ctx: Ctx }) {
  const [services, setServices] = useState(() => listRepairServices(ctx));
  const run = (what: () => unknown) => {
    try {
      what();
    } catch (error) {
      haptic.error();
      Alert.alert('لم يُحفظ', error instanceof RuleError ? error.message : 'حدث خطأ غير متوقع.');
      return;
    }
    haptic.success();
    setServices(listRepairServices(ctx));
    notifyDataChanged();
  };

  const edit = async (old?: RepairService) => {
    const name = await ask(
      old ? 'اسم الخدمة' : 'خدمة جديدة',
      'مثلاً: تلميع، لحام، تغيير قفل',
      old?.name ?? '',
      'default',
    );
    if (name === null) return;
    const typed = await ask(
      `سعر «${name.trim()}»`,
      'بالدينار. اتركه فارغاً إذا كان السعر يحدده المالك لكل قطعة.',
      old?.price != null ? editableDinars(old.price) : '',
      'decimal-pad',
    );
    if (typed === null) return;
    const price = typed.trim() ? parseThousandths(typed) : null;
    if (typed.trim() && price === null) {
      haptic.error();
      Alert.alert('لم يُحفظ', 'السعر غير صحيح');
      return;
    }
    run(() => saveRepairService(ctx, { id: old?.id, name, price }));
  };

  const open = (s: RepairService) =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: `${s.name} • ${servicePriceText(s.price)}`,
        options: ['تعديل', 'حذف من القائمة', 'إلغاء'],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      (i) => {
        if (i === 0) void edit(s);
        if (i === 1)
          Alert.alert(`حذف «${s.name}»؟`, 'الصيانات التي أُخذت بها تبقى بسعرها.', [
            { text: 'إلغاء', style: 'cancel' },
            {
              text: 'حذف',
              style: 'destructive',
              onPress: () => run(() => removeRepairService(ctx, s.id)),
            },
          ]);
      },
    );

  return (
    <View style={{ gap: spacing.sm }} testID="repair-services-card">
      <Text variant="subhead" tone="secondary">
        خدمات الصيانة وأسعارها
      </Text>
      {services.length ? (
        <ListGroup>
          {services.map((s) => (
            <ListRow
              key={s.id}
              icon="wrench.and.screwdriver"
              title={s.name}
              value={servicePriceText(s.price)}
              onPress={() => open(s)}
              testID={`repair-service-row-${s.id}`}
            />
          ))}
        </ListGroup>
      ) : (
        <Text variant="caption" tone="secondary">
          لا خدمات بعد: الموظف يكتب السعر بنفسه. أضف خدماتك ليختارها الموظف بأسعارك.
        </Text>
      )}
      <Button
        title="إضافة خدمة"
        icon="plus"
        variant="secondary"
        onPress={() => void edit()}
        testID="repair-service-add"
      />
    </View>
  );
}
