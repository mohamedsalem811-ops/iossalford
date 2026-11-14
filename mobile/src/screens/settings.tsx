import { ListGroup, ListRow, Page, Segmented, Text } from '@/components';
import { APPEARANCES } from '@/state/appearance';
import type { Appearance, SystemId } from '@/theme';

export type UpdateRows = {
  /** Updates work only in the installed app (not in Expo Go). */
  enabled: boolean;
  /** Which version is running ("النسخة المثبّتة", "تحديث 12 نوفمبر…"). */
  running: string;
  /** A downloaded update is waiting for a restart. */
  pending: boolean;
  busy: boolean;
  onCheck: () => void;
  onRestart: () => void;
};

/** Management → Settings: the dollar rate, the PIN, the appearance, updates and the version. */
export function SettingsScreen({
  system,
  rate,
  appearance,
  version,
  updates,
  errors,
  onEditRate,
  loyalty,
  onChangePin,
  onAppearance,
}: {
  system: SystemId;
  rate: string;
  appearance: Appearance;
  version: string;
  updates: UpdateRows;
  /** Errors written to the log on this device; opening it offers to share or clear it. */
  errors: { count: number; onOpen: () => void };
  /** Absent for someone who may not change it: the rate is shown, not editable. */
  onEditRate?: () => void;
  /** Loyalty points (F3), for the owner: on or off, and the screen with the rules. */
  loyalty?: { on: boolean; onOpen: () => void };
  onChangePin: () => void;
  onAppearance: (a: Appearance) => void;
}) {
  return (
    <Page>
      <ListGroup header="المال">
        <ListRow
          icon="dollarsign.circle"
          title="سعر الصرف"
          value={rate}
          onPress={onEditRate}
          testID="settings-rate"
        />
        {loyalty ? (
          <ListRow
            icon="star.circle"
            title="نقاط الولاء"
            value={loyalty.on ? 'تعمل' : 'متوقفة'}
            onPress={loyalty.onOpen}
            testID="settings-loyalty"
          />
        ) : null}
      </ListGroup>
      <ListGroup
        header="الأمان"
        footer={
          system === 'jewelry'
            ? 'لكل نظام رمزه. Face ID يفتح نظام المجوهرات، والرمز يعمل دائماً.'
            : 'لكل نظام رمزه.'
        }>
        <ListRow
          icon="lock.rotation"
          title="تغيير رمز الدخول"
          onPress={onChangePin}
          testID="settings-pin"
        />
      </ListGroup>
      <ListGroup header="المظهر" footer="«تلقائي» يتبع إعداد الجهاز. يطبّق على النظامين.">
        <Segmented
          options={APPEARANCES}
          value={appearance}
          onChange={onAppearance}
          testID="settings-appearance"
        />
      </ListGroup>
      <ListGroup
        header="التحديثات"
        footer={
          updates.enabled
            ? 'يتحقق التطبيق من التحديثات عند فتحه إذا كان الإنترنت متاحاً، ولا ينتظرها أبداً. بدون إنترنت يعمل بالنسخة الموجودة.'
            : undefined
        }>
        <ListRow icon="checkmark.seal" title="النسخة العاملة" value={updates.running} />
        {updates.pending ? (
          <ListRow
            icon="arrow.clockwise"
            title="تحديث جاهز — أعد التشغيل"
            onPress={updates.onRestart}
            testID="settings-update-restart"
          />
        ) : null}
        {updates.enabled ? (
          <ListRow
            icon="arrow.down.circle"
            title="تحقق من التحديثات"
            value={updates.busy ? 'جارٍ التحقق…' : undefined}
            onPress={updates.busy ? undefined : updates.onCheck}
            testID="settings-update-check"
          />
        ) : null}
      </ListGroup>
      <ListGroup
        header="التطبيق"
        footer="سجل الأخطاء يبقى على هذا الجهاز. أرسله عند حدوث مشكلة ليُعرف سببها وتُصلح.">
        <ListRow icon="info.circle" title="الإصدار" value={version} />
        <ListRow
          icon="ladybug"
          title="سجل الأخطاء"
          value={errors.count ? String(errors.count) : 'لا أخطاء'}
          tone={errors.count ? 'warning' : 'normal'}
          onPress={errors.count ? errors.onOpen : undefined}
          testID="settings-errors"
        />
      </ListGroup>
      <Text variant="caption" tone="secondary" center>
        SALFORD POS — بياناتك على هذا الجهاز فقط.
      </Text>
    </Page>
  );
}
