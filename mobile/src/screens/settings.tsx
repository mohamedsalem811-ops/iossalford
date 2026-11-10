import { ListGroup, ListRow, Page, Segmented, Text } from '@/components';
import { APPEARANCES } from '@/state/appearance';
import type { Appearance, SystemId } from '@/theme';

/** Management → Settings: the dollar rate, the PIN, the appearance and the app's version. */
export function SettingsScreen({
  system,
  rate,
  appearance,
  version,
  onEditRate,
  onChangePin,
  onAppearance,
}: {
  system: SystemId;
  rate: string;
  appearance: Appearance;
  version: string;
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
      <ListGroup header="التطبيق">
        <ListRow icon="info.circle" title="الإصدار" value={version} />
      </ListGroup>
      <Text variant="caption" tone="secondary" center>
        SALFORD POS — بياناتك على هذا الجهاز فقط.
      </Text>
    </Page>
  );
}
