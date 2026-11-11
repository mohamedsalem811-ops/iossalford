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
  onEditRate,
  onChangePin,
  onAppearance,
}: {
  system: SystemId;
  rate: string;
  appearance: Appearance;
  version: string;
  updates: UpdateRows;
  onEditRate: () => void;
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
      <ListGroup header="التطبيق">
        <ListRow icon="info.circle" title="الإصدار" value={version} />
      </ListGroup>
      <Text variant="caption" tone="secondary" center>
        SALFORD POS — بياناتك على هذا الجهاز فقط.
      </Text>
    </Page>
  );
}
