import { Platform, PermissionsAndroid } from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { authenticatedImageSource } from './api';

export type SaveResult = { success: true } | { success: false; error: string };

// Scoped storage (API 29+) doesn't need this; older Android needs the runtime grant
// before CameraRoll can write to the shared Pictures directory.
async function ensureAndroidWritePermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version >= 29) {
    return true;
  }
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

function extensionFromUri(uri: string): string {
  const withoutQuery = uri.split('?')[0];
  const match = /\.([a-zA-Z0-9]+)$/.exec(withoutQuery);
  return match ? match[1] : 'jpg';
}

// Images are served through our authenticated /media/:id proxy, not a public URL, so
// CameraRoll (which fetches the tag itself with no auth) can't be pointed at it directly.
// Download the authenticated bytes to a local temp file first, then hand that local
// file:// path to CameraRoll.
export async function saveImageToDevice(remoteUri: string): Promise<SaveResult> {
  try {
    const hasPermission = await ensureAndroidWritePermission();
    if (!hasPermission) {
      return { success: false, error: 'Photo library permission was denied.' };
    }

    const { headers } = authenticatedImageSource(remoteUri);
    const extension = extensionFromUri(remoteUri);
    const tempPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/lashlyai-${Date.now()}.${extension}`;

    const response = await ReactNativeBlobUtil.config({ path: tempPath }).fetch(
      'GET',
      remoteUri,
      headers ?? {},
    );

    const localPath = response.path();
    const tag = Platform.OS === 'ios' ? `file://${localPath}` : localPath;
    await CameraRoll.save(tag, { type: 'photo' });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save image.',
    };
  }
}

// For locally-rendered captures (e.g. a react-native-view-shot snapshot of the lash
// map diagram) that are already a local file:// path — no auth fetch needed.
export async function saveLocalImageToDevice(localUri: string): Promise<SaveResult> {
  try {
    const hasPermission = await ensureAndroidWritePermission();
    if (!hasPermission) {
      return { success: false, error: 'Photo library permission was denied.' };
    }
    await CameraRoll.save(localUri, { type: 'photo' });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save image.',
    };
  }
}

// Video Retouch's processed output is already a local file:// path (the native
// module's own export, never fetched from the backend) — same no-auth-fetch shape as
// saveLocalImageToDevice above, just type: 'video' so it lands in Videos, not Photos.
export async function saveLocalVideoToDevice(localUri: string): Promise<SaveResult> {
  try {
    const hasPermission = await ensureAndroidWritePermission();
    if (!hasPermission) {
      return { success: false, error: 'Photo library permission was denied.' };
    }
    await CameraRoll.save(localUri, { type: 'video' });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save video.',
    };
  }
}
