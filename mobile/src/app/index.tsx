import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import Constants from 'expo-constants';

/** Phase 0 placeholder: proves the build installs and opens. Replaced in Phase 3. */
export default function Index() {
  const dark = useColorScheme() === 'dark';
  const version = Constants.expoConfig?.version ?? '';
  return (
    <View style={[styles.root, { backgroundColor: dark ? '#07070F' : '#F6F5F1' }]}>
      <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
      <Text style={[styles.title, { color: dark ? '#E8F0FF' : '#122452' }]}>SALFORD POS</Text>
      <Text style={[styles.subtitle, { color: dark ? '#B8965A' : '#8A682E' }]}>
        النسخة الجديدة قيد الإنشاء
      </Text>
      <Text style={[styles.version, { color: dark ? '#8C9EC0' : '#58647E' }]}>{version}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  logo: { width: 120, height: 120, borderRadius: 28 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: 2 },
  subtitle: { fontSize: 17, fontWeight: '600' },
  version: { fontSize: 13 },
});
