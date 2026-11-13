import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Card, Text } from '@/components';
import { errorBoundary } from '@/components/error-screen';
import { useReadable } from '@/hooks/use-readable';
import { Allowed } from '@/staff/allowed';
import { spacing, useTheme } from '@/theme';

type Section = { title: string; why: string; steps: string[]; note?: string };

/**
 * What iOS itself can lock on the shop's devices, in the owner's words. The app cannot change
 * these settings; the owner sets them once on each device.
 */
export const GUIDE: Section[] = [
  {
    title: 'الوصول الموجّه: يبقى الموظف داخل التطبيق',
    why: 'يمنع الخروج من SALFORD إلى تطبيقات أخرى أو الإعدادات حتى تكتب رمزك.',
    steps: [
      'الإعدادات ← تسهيلات الاستخدام ← الوصول الموجّه ← شغّله.',
      'إعدادات رمز الدخول ← تعيين رمز الوصول الموجّه: رمز تعرفه أنت فقط، غير رمز الجهاز.',
      'من نفس الصفحة: قفل الشاشة التلقائي، اختر مدة قصيرة.',
      'لبدء العمل: افتح SALFORD ثم اضغط الزر الجانبي ثلاث مرات بسرعة (أو زر الشاشة الرئيسية في الأجهزة التي فيها زر) ← ابدأ.',
      'للخروج: اضغط ثلاث مرات واكتب رمز الوصول الموجّه.',
    ],
  },
  {
    title: 'مدة استخدام الجهاز: لا يُحذف التطبيق',
    why: 'حذف التطبيق يحذف كل بيانات المحل من الجهاز. هذا القفل يمنع الحذف إلا برمزك.',
    steps: [
      'الإعدادات ← مدة استخدام الجهاز ← شغّلها.',
      'قفل إعدادات مدة استخدام الجهاز: اختر رمزاً من 4 أرقام تعرفه أنت فقط.',
      'قيود المحتوى والخصوصية ← شغّلها.',
      'مشتريات iTunes و App Store ← حذف التطبيقات ← عدم السماح.',
      'في نفس الصفحة، تحت «السماح بالتغييرات»: تغييرات رمز الدخول ← عدم السماح، وتغييرات الحساب ← عدم السماح.',
    ],
    note: 'مع ذلك احتفظ دائماً بنسخة احتياطية خارج الجهاز (الإدارة ← النسخ الاحتياطي).',
  },
  {
    title: 'التاريخ والوقت: ضبط تلقائي لا يُغيَّر',
    why: 'التطبيق يرفض الحفظ إذا رجعت ساعة الجهاز للخلف، ويسجل ذلك. الضبط التلقائي يمنع العبث بالوقت.',
    steps: [
      'الإعدادات ← عام ← التاريخ والوقت ← ضبط تلقائياً: شغّله.',
      'بعد تشغيل رمز مدة استخدام الجهاز يصبح هذا الخيار غير قابل للإيقاف. إن ظهر رمادياً فهذا هو المطلوب.',
    ],
  },
  {
    title: 'Face ID: وجهك فقط',
    why: 'التطبيق يقبل Face ID على الجهاز كموافقتك على الخصم والمرتجع. أي وجه مسجّل يستطيع الموافقة.',
    steps: [
      'الإعدادات ← Face ID ورمز الدخول: تأكد أن الوجه المسجّل وجهك فقط، ولا يوجد «مظهر بديل» لشخص آخر.',
      'لا تعطِ رمز الجهاز لأحد: من يعرفه يستطيع تسجيل وجهه.',
    ],
  },
  {
    title: 'رموز الموظفين',
    why: 'كل عمل يُسجَّل باسم من سجّل الدخول.',
    steps: [
      'لكل موظف رمزه الخاص من 6 أرقام (الإدارة ← الموظفون)، ولا يتشارك موظفان رمزاً.',
      'أوقف حساب من ترك العمل بدل حذفه، فيبقى سجله.',
      'رمز المالك لك وحدك.',
    ],
  },
];

/** Management → Protect the devices (phase S6, the owner): the iOS settings, step by step. */
function DeviceGuideScreen() {
  const readable = useReadable();
  const { colors } = useTheme();
  return (
    <>
      <Stack.Title>حماية الأجهزة</Stack.Title>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        onLayout={readable.onLayout}
        contentContainerStyle={{
          ...readable.padding,
          paddingVertical: spacing.md,
          gap: spacing.md,
        }}
        contentInsetAdjustmentBehavior="automatic">
        <Text variant="subhead" tone="secondary">
          إعدادات من iOS نفسه تُضبط مرة على كل جهاز في المحل. قد تختلف أسماء القوائم قليلاً حسب نسخة
          iOS.
        </Text>
        {GUIDE.map((s, i) => (
          <Card key={s.title} testID={`guide-${i}`}>
            <Text variant="headline">{s.title}</Text>
            <Text variant="caption" tone="secondary">
              {s.why}
            </Text>
            <View style={{ gap: spacing.xs }}>
              {s.steps.map((step, n) => (
                <Text key={step} variant="body">{`${n + 1}. ${step}`}</Text>
              ))}
            </View>
            {s.note ? (
              <Text variant="caption" tone="warning">
                {s.note}
              </Text>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </>
  );
}

/** The owner only (`settings.edit`). */
export default function DeviceGuideRoute() {
  return (
    <Allowed permission="settings.edit" title="حماية الأجهزة">
      <DeviceGuideScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/device-guide');
