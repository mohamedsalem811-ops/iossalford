import NativeSegmentedControl from '@expo/ui/community/segmented-control';

import { useTheme } from '@/theme';

/** The native iOS segmented control (اليوم / الأسبوع / الشهر). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
}) {
  const { mode } = useTheme();
  return (
    <NativeSegmentedControl
      testID={testID}
      values={options.map((o) => o.label)}
      selectedIndex={Math.max(
        0,
        options.findIndex((o) => o.value === value),
      )}
      onChange={(e) => {
        const picked = options[e.nativeEvent.selectedSegmentIndex];
        if (picked) onChange(picked.value);
      }}
      appearance={mode}
      style={{ height: 34 }}
    />
  );
}
