import { SymbolView, type SymbolViewProps } from 'expo-symbols';

/** An SF Symbol. Defaults to the current text colour of the caller via `color`. */
export function Icon({
  name,
  size = 20,
  color,
  weight = 'medium',
}: {
  name: SymbolViewProps['name'];
  size?: number;
  color: string;
  weight?: SymbolViewProps['weight'];
}) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
    />
  );
}
