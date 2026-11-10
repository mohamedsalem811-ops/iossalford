/**
 * Product and brand photos on the device: taken with the camera or chosen from the library,
 * resized, and kept in the app's own documents folder (one folder per system). Only the file
 * name is stored in the database. Nothing is uploaded anywhere.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { SystemId } from '@/theme';

/** Longest side of a saved photo, in pixels: sharp on an iPad, small on disk. */
export const PHOTO_MAX_SIDE = 1600;
const JPEG_QUALITY = 0.8;

export type PhotoSource = 'camera' | 'library';

export type PickResult =
  | { status: 'picked'; file: string }
  | { status: 'canceled' }
  /** The owner said no to the camera or photos; the message explains how to allow it. */
  | { status: 'denied'; message: string };

function folder(system: SystemId): Directory {
  const dir = new Directory(Paths.document, 'photos', system);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** The address to show a saved photo with expo-image. */
export function photoUri(system: SystemId, file: string): string {
  return new File(Paths.document, 'photos', system, file).uri;
}

const DENIED = {
  camera: 'اسمح للتطبيق باستخدام الكاميرا من الإعدادات ← SALFORD POS ← الكاميرا.',
  library: 'اسمح للتطبيق بالوصول إلى الصور من الإعدادات ← SALFORD POS ← الصور.',
};

/**
 * Opens the camera or the photo library, resizes the chosen picture and saves it under `name`
 * (from newPhotoName). Returns the saved file name.
 */
export async function pickPhoto(
  system: SystemId,
  source: PhotoSource,
  name: string,
): Promise<PickResult> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied', message: DENIED[source] };

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return { status: 'canceled' };

  // Decoded at the reduced size, so a large camera photo is never fully loaded into memory.
  const image = await ImageManipulator.manipulate(result.assets[0].uri, {
    maxWidth: PHOTO_MAX_SIDE,
    maxHeight: PHOTO_MAX_SIDE,
  }).renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  await new File(saved.uri).move(new File(folder(system), name));
  return { status: 'picked', file: name };
}

/** Removes a photo file. Call only when nothing uses it any more (see photoInUse). */
export function deletePhotoFile(system: SystemId, file: string) {
  const f = new File(Paths.document, 'photos', system, file);
  if (f.exists) f.delete();
}
