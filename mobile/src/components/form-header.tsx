import { Stack } from 'expo-router';

/** A form's title with its cancel and save buttons, in the native header of its sheet. */
export function FormHeader({
  title,
  onCancel,
  onSave,
  cancelLabel = 'إلغاء',
}: {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  cancelLabel?: string;
}) {
  return (
    <>
      <Stack.Title>{title}</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={onCancel}>{cancelLabel}</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button variant="done" onPress={onSave}>
          حفظ
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}
