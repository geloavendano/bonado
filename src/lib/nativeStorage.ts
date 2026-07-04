import { Preferences } from "@capacitor/preferences";

/**
 * Supabase auth storage backed by Capacitor Preferences (UserDefaults /
 * SharedPreferences) instead of WebView localStorage, which the OS can
 * clear independently of app data. Upgrading to Keychain/Keystore later
 * only means swapping the Preferences calls for a secure-storage plugin —
 * the adapter surface stays the same.
 */
export const nativeAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  },
  async setItem(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  },
  async removeItem(key: string): Promise<void> {
    await Preferences.remove({ key });
  },
};
