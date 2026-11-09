import { useState } from 'react';
import { View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  ChipRow,
  EmptyState,
  HeroCard,
  ListGroup,
  ListRow,
  Logo,
  NumberField,
  Screen,
  SectionHeader,
  Segmented,
  Sheet,
  Stat,
  Text,
  TextField,
} from '@/components';
import { useLayout } from '@/hooks/use-layout';
import { formatDay } from '@/lib/dates';
import { formatLyd } from '@/lib/money';
import { spacing, ThemeProvider, type SystemId } from '@/theme';

type Look = 'light' | 'dark';

/**
 * Every shared component on one screen, for checking the design in both systems and both modes.
 * Not linked from the app's menus; opened with salfordpos://gallery (and by the simulator tests).
 */
export function Gallery() {
  const [system, setSystem] = useState<SystemId>('jewelry');
  const [look, setLook] = useState<Look>('light');
  return (
    <ThemeProvider system={system} appearance={look}>
      <GalleryBody system={system} setSystem={setSystem} look={look} setLook={setLook} />
    </ThemeProvider>
  );
}

function GalleryBody({
  system,
  setSystem,
  look,
  setLook,
}: {
  system: SystemId;
  setSystem: (s: SystemId) => void;
  look: Look;
  setLook: (l: Look) => void;
}) {
  const layout = useLayout();
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [brand, setBrand] = useState('all');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [sheet, setSheet] = useState(false);
  const jewelry = system === 'jewelry';

  return (
    <Screen maxWidth={layout.split ? 900 : 760}>
      <View style={{ gap: spacing.sm }}>
        <Segmented
          testID="gallery-system"
          options={[
            { value: 'jewelry', label: 'المجوهرات' },
            { value: 'scarves', label: 'الأوشحة' },
          ]}
          value={system}
          onChange={setSystem}
        />
        <Segmented
          testID="gallery-look"
          options={[
            { value: 'light', label: 'فاتح' },
            { value: 'dark', label: 'داكن' },
          ]}
          value={look}
          onChange={setLook}
        />
      </View>

      <View style={{ alignItems: 'center', paddingTop: spacing.sm }}>
        <Logo system={system} width={120} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="subhead" tone="secondary">
          صباح الخير · {formatDay(new Date())}
        </Text>
        <Badge label="$ 7.125" />
      </View>

      <Segmented
        options={[
          { value: 'day', label: 'اليوم' },
          { value: 'week', label: 'الأسبوع' },
          { value: 'month', label: 'الشهر' },
        ]}
        value={period}
        onChange={setPeriod}
      />

      <HeroCard>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}>
          <View>
            <Text variant="subhead" tone="onAccent">
              مبيعات اليوم
            </Text>
            <Text variant="hero" tone="onAccent">
              {formatLyd(jewelry ? 4_350_000 : 1_980_000)}
            </Text>
          </View>
          <Badge label={jewelry ? '+18% عن أمس' : '+6% عن أمس'} tone="onAccent" />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Stat value={jewelry ? '1,120' : '640'} label="الربح" onAccent />
          <Stat value={jewelry ? '6' : '9'} label="فواتير" onAccent />
          <Stat value={jewelry ? '11' : '14'} label={jewelry ? 'قطعة' : 'وشاح'} onAccent />
        </View>
      </HeroCard>

      <ListGroup header="اليوم">
        <ListRow
          icon="chart.line.uptrend.xyaxis"
          title="صافي الربح"
          value={formatLyd(jewelry ? 1_120_000 : 640_000)}
          onPress={() => {}}
        />
        <ListRow icon="doc.text" title="الفواتير" value={jewelry ? '6' : '9'} onPress={() => {}} />
        <ListRow
          icon="exclamationmark.triangle"
          title={jewelry ? 'نقص المخزون' : 'مقاس 140×140'}
          value={jewelry ? '2 منتج' : '3 فقط'}
          tone="warning"
          onPress={() => {}}
        />
        <ListRow
          icon="person.2"
          title="ديون العملاء"
          subtitle="3 عملاء"
          value={formatLyd(2_400_000)}
          onPress={() => {}}
        />
      </ListGroup>

      <SectionHeader title="الفلاتر" action="عرض الكل" onAction={() => {}} />
      <ChipRow
        options={
          jewelry
            ? [
                { value: 'all', label: 'الكل' },
                { value: 'pandora', label: 'Pandora' },
                { value: 'swarovski', label: 'Swarovski' },
                { value: 'silver', label: 'فضة' },
              ]
            : [
                { value: 'all', label: 'الكل' },
                { value: '90', label: '90×90' },
                { value: '120', label: '120×120' },
                { value: '140', label: '140×140' },
              ]
        }
        value={brand}
        onChange={setBrand}
      />

      <SectionHeader title="الأزرار" />
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button title="إتمام البيع" icon="checkmark" />
          <Button title="إضافة منتج" variant="secondary" icon="plus" />
          <Button title="إلغاء" variant="ghost" />
          <Button title="حذف" variant="destructive" icon="trash" />
          <Button title="جارٍ الحفظ" loading />
          <Button title="غير متاح" disabled />
          <Button
            title="فتح النافذة"
            size="sm"
            variant="secondary"
            onPress={() => setSheet(true)}
            testID="gallery-open-sheet"
          />
        </View>
        <Button title="الدفع · 1,150 د.ل" size="lg" fullWidth />
      </Card>

      <SectionHeader title="الحقول" />
      <Card>
        <TextField
          label="اسم المنتج"
          value={name}
          onChangeText={setName}
          placeholder="مثال: خاتم زركون"
        />
        <NumberField
          label="سعر البيع"
          value={price}
          onChangeText={setPrice}
          placeholder="0"
          suffix="د.ل"
          hint="الأرقام تُكتب 0-9 فقط"
        />
        <NumberField
          label="الكمية"
          kind="integer"
          value=""
          onChangeText={() => {}}
          error="الكمية أكبر من المتوفر"
        />
      </Card>

      <SectionHeader title="قائمة فارغة" />
      <Card>
        <EmptyState
          icon="tray"
          title="لا توجد مبيعات بعد"
          message="ستظهر هنا مبيعات اليوم عند أول عملية بيع."
          action="بيع جديد"
          onAction={() => {}}
        />
      </Card>

      <Text variant="caption" tone="secondary" center>
        الشاشة: {layout.layoutClass} · أعمدة المنتجات: {layout.columns()}
      </Text>

      <Sheet visible={sheet} onClose={() => setSheet(false)}>
        <Text variant="title">نافذة منبثقة</Text>
        <Text variant="body" tone="secondary">
          تُستخدم لاختيار المقاس وتعديل الكمية والسعر وتأكيد العمليات.
        </Text>
        <Button title="تم" fullWidth onPress={() => setSheet(false)} />
      </Sheet>
    </Screen>
  );
}
