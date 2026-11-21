import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import {
  Button,
  Card,
  FilterChip,
  FormHeader,
  KEYBOARD_GAP,
  NumberField,
  Segmented,
  Text,
  TextField,
  useSheetBottomSpace,
} from '@/components';
import { RuleError, type Ctx } from '@/domain/context';
import {
  customerSuggestions,
  getCustomer,
  shownName,
  shownPhone,
  type Customer,
} from '@/domain/customers';
import { getRepairRules, REPAIR_WORKS, takeRepair, WORK_LABELS } from '@/domain/repairs';
import { listRepairServices, servicePriceText } from '@/domain/repair-services';
import { PAYMENT_WAYS } from '@/features/customers/model';
import { PhotoPicker } from '@/features/products/photo-picker';
import { ProductPhoto } from '@/features/products/product-photo';
import { releasePhoto } from '@/features/products/actions';
import { dayKey } from '@/lib/dates';
import { parseThousandths } from '@/lib/digits';
import { haptic } from '@/lib/haptics';
import { formatLyd } from '@/lib/money';
import { useSaveOnce } from '@/hooks/use-save-once';
import { useCan } from '@/staff/use-can';
import { notifyDataChanged } from '@/state/data-events';
import { radius, spacing, useTheme } from '@/theme';

import {
  emptyRepairForm,
  repairFormProblem,
  servicesInput,
  servicesTotal,
  type RepairForm,
} from './model';

const MAX_PHOTOS = 6;

/**
 * A new repair (J3): the customer's name and phone, the piece (description and photos), the
 * work, the agreed price (0: free), the ready date, and an optional deposit. Saving opens its
 * ticket through `onDone`.
 */
export function RepairFormView({
  ctx,
  customerId,
  onCancel,
  onDone,
}: {
  ctx: Ctx;
  customerId?: number;
  onCancel: () => void;
  onDone: (repairId: number) => void;
}) {
  const { colors } = useTheme();
  const once = useSaveOnce();
  const bottomSpace = useSheetBottomSpace();
  const phones = useCan('customers.phones');
  const rules = getRepairRules(ctx);
  const owner = ctx.actor?.kind === 'owner';
  // The owner's services (rule D): with a list, the work is ticked and its price is the owner's.
  const [services] = useState(() => listRepairServices(ctx));
  const withServices = services.length > 0;
  const [picked, setPicked] = useState<Customer | null>(() =>
    customerId ? (getCustomer(ctx, customerId) ?? null) : null,
  );
  const [form, setForm] = useState<RepairForm>(() => {
    const ready = new Date(ctx.now());
    ready.setDate(ready.getDate() + 3);
    return {
      ...emptyRepairForm(dayKey(ready)),
      name: picked?.name ?? '',
      phone: phones ? (picked?.phone ?? '') : '',
    };
  });
  const set = <K extends keyof RepairForm>(k: K, v: RepairForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Photos picked here and not kept are removed when the form closes.
  const pickedFiles = useRef(new Set<string>());
  const [photos, setPhotos] = useState<string[]>([]);
  const saved = useRef<string[]>([]);
  useEffect(() => {
    const files = pickedFiles.current;
    return () => files.forEach((f) => !saved.current.includes(f) && releasePhoto(ctx, f));
  }, [ctx]);

  const suggestions = form.name && !picked ? customerSuggestions(ctx, form.name, 4, phones) : [];
  const customer = picked && picked.name === form.name.trim() ? picked : null;
  const total = servicesTotal(form, services, owner);
  const price = withServices ? total.price : parseThousandths(form.price);
  const toggle = (id: number) => {
    haptic.tap();
    setForm((f) => ({
      ...f,
      picked: f.picked.includes(id) ? f.picked.filter((x) => x !== id) : [...f.picked, id],
    }));
  };
  const deposit = parseThousandths(form.deposit) ?? 0;

  const pick = (c: Customer) => {
    haptic.tap();
    setPicked(c);
    setForm((f) => ({ ...f, name: c.name, phone: phones ? (c.phone ?? f.phone) : f.phone }));
  };

  const save = () => {
    const phone = form.phone.trim() || customer?.phone || '';
    const problem = repairFormProblem({ ...form, phone }, services, owner);
    if (problem) {
      haptic.error();
      Alert.alert('لم تُحفظ الصيانة', problem);
      return;
    }
    try {
      const r = takeRepair(ctx, {
        customer: { name: form.name.trim(), phone },
        description: form.description,
        ...(withServices
          ? { services: servicesInput(form, services, owner) }
          : { work: form.work, price: price! }),
        photos,
        note: form.note,
        readyBy: form.readyBy,
        ...(deposit > 0 ? { deposit: { amount: deposit, method: form.method } } : {}),
      });
      saved.current = photos;
      haptic.success();
      notifyDataChanged();
      onDone(r.repairId);
      return true;
    } catch (error) {
      haptic.error();
      Alert.alert(
        'لم تُحفظ الصيانة',
        error instanceof RuleError ? error.message : 'حدث خطأ غير متوقع، لم يُحفظ شيء.',
      );
    }
  };
  const saveOnce = () => once(save);

  return (
    <>
      <FormHeader title="صيانة جديدة" onCancel={onCancel} onSave={saveOnce} />
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: bottomSpace, gap: spacing.md }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled">
        <Card>
          <Text variant="subhead" tone="secondary">
            الزبون
          </Text>
          <TextField
            label="الاسم"
            value={form.name}
            onChangeText={(t) => set('name', t)}
            placeholder="اسم الزبون"
            testID="repair-name"
          />
          {suggestions.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {suggestions.map((c) => (
                <FilterChip
                  key={c.id}
                  label={
                    c.phone
                      ? `${shownName(c.name, phones)} • ${shownPhone(c.phone, phones)}`
                      : shownName(c.name, phones)
                  }
                  selected={false}
                  onPress={() => pick(c)}
                />
              ))}
            </View>
          ) : null}
          {customer && !phones && customer.phone ? (
            <Text variant="caption" tone="secondary" testID="repair-known-phone">
              {`الهاتف المحفوظ: ${shownPhone(customer.phone, false)}`}
            </Text>
          ) : (
            <NumberField
              label="رقم الهاتف"
              kind="phone"
              value={form.phone}
              onChangeText={(t) => set('phone', t)}
              placeholder="09XXXXXXXX"
              testID="repair-phone"
            />
          )}
        </Card>

        <Card>
          <Text variant="subhead" tone="secondary">
            القطعة
          </Text>
          {photos.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {photos.map((file) => (
                <Pressable
                  key={file}
                  accessibilityRole="button"
                  accessibilityLabel="حذف الصورة"
                  onPress={() => setPhotos((list) => list.filter((f) => f !== file))}>
                  <ProductPhoto
                    system={ctx.system}
                    imageFile={file}
                    size={72}
                    rounded={radius.md}
                  />
                </Pressable>
              ))}
            </View>
          ) : null}
          {photos.length < MAX_PHOTOS ? (
            <PhotoPicker
              ctx={ctx}
              imageFile={null}
              placeholder={photos.length ? 'صورة أخرى (اختياري)' : 'صورة القطعة كما استُلمت'}
              onPicked={(file) => {
                pickedFiles.current.add(file);
                setPhotos((list) => [...list, file]);
              }}
              onRemove={() => undefined}
            />
          ) : null}
          <TextField
            label="وصف القطعة"
            value={form.description}
            onChangeText={(t) => set('description', t)}
            placeholder="مثلاً: خاتم ذهب أصفر بحجر أزرق"
            testID="repair-description"
          />
          <Text variant="subhead" tone="secondary">
            {withServices ? 'الخدمات المطلوبة (أسعار المالك)' : 'العمل المطلوب'}
          </Text>
          {withServices ? (
            <View style={{ gap: spacing.sm }} testID="repair-services">
              {services.map((sv) => {
                const on = form.picked.includes(sv.id);
                return (
                  <View key={sv.id} style={{ gap: spacing.xs }}>
                    <FilterChip
                      label={`${on ? '✓ ' : ''}${sv.name} • ${servicePriceText(sv.price)}`}
                      selected={on}
                      onPress={() => toggle(sv.id)}
                      testID={`repair-service-${sv.id}`}
                    />
                    {on && sv.price === null && owner ? (
                      <NumberField
                        label={`سعر «${sv.name}» (أو اتركه لاحقاً)`}
                        value={form.ownerPrices[sv.id] ?? ''}
                        onChangeText={(t) =>
                          setForm((f) => ({ ...f, ownerPrices: { ...f.ownerPrices, [sv.id]: t } }))
                        }
                        suffix="د.ل"
                        testID={`repair-service-price-${sv.id}`}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {REPAIR_WORKS.map((w) => (
                <FilterChip
                  key={w}
                  label={WORK_LABELS[w]}
                  selected={form.work === w}
                  onPress={() => set('work', w)}
                  testID={`repair-work-${w}`}
                />
              ))}
            </View>
          )}
          <TextField
            label="ملاحظات"
            value={form.note}
            onChangeText={(t) => set('note', t)}
            placeholder="المقاس المطلوب، خدوش موجودة…"
            testID="repair-note"
          />
        </Card>

        <Card>
          {withServices ? (
            <Text variant="bodyStrong" testID="repair-total">
              {`المجموع: ${formatLyd(total.price)}${total.pending ? ` + ${total.pending} بسعر يحدده المالك` : ''}`}
            </Text>
          ) : (
            <NumberField
              label="السعر المتفق عليه (0 للمجانية)"
              value={form.price}
              onChangeText={(t) => set('price', t)}
              suffix="د.ل"
              testID="repair-price"
            />
          )}
          <TextField
            label="تاريخ الجاهزية"
            value={form.readyBy}
            onChangeText={(t) => set('readyBy', t)}
            placeholder="2026-12-01"
            testID="repair-ready-by"
          />
          <NumberField
            label="العربون (اختياري)"
            value={form.deposit}
            onChangeText={(t) => set('deposit', t)}
            suffix="د.ل"
            testID="repair-deposit"
          />
          {deposit > 0 ? (
            <Segmented
              options={PAYMENT_WAYS.map((w) => ({ value: w.value, label: w.label }))}
              value={form.method}
              onChange={(m) => set('method', m)}
              testID="repair-method"
            />
          ) : null}
          <Text variant="caption" tone="secondary">
            {rules.note}
          </Text>
          <Button
            title={
              price !== null && price > 0 ? `استلام القطعة • ${formatLyd(price)}` : 'استلام القطعة'
            }
            icon="checkmark.circle.fill"
            size="lg"
            fullWidth
            onPress={saveOnce}
            testID="repair-save"
          />
        </Card>
      </KeyboardAwareScrollView>
    </>
  );
}
