import { I18nManager } from 'react-native';

/**
 * The app is Arabic-only, so RTL is forced rather than following the device.
 *
 * `forceRTL` writes a native flag that only takes effect on the next launch, so
 * the first run after install has to reload itself once. `isRTL` is false until
 * that reload happens, which is also what keeps this from looping: on every
 * launch after the first, the flag is already set and we do nothing.
 */
export function needsRtlReload(): boolean {
  return !I18nManager.isRTL;
}

export function applyRtl(): void {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

/**
 * Reload the JS so the forced RTL flag applies.
 *
 * `expo-updates` owns reloading in a built app; in Expo Go and dev clients it
 * throws, so `DevSettings` is the fallback. If neither works we return false and
 * the caller asks the user to reopen the app — never leave a half-LTR layout up.
 */
export async function reloadForRtl(): Promise<boolean> {
  try {
    const Updates = await import('expo-updates');
    await Updates.reloadAsync();
    return true;
  } catch {
    try {
      const { DevSettings } = await import('react-native');
      if (typeof DevSettings?.reload === 'function') {
        DevSettings.reload();
        return true;
      }
    } catch {
      // fall through
    }
    return false;
  }
}
