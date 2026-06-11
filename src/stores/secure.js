// secure.js — Secure secret storage (Android Keystore-backed via capacitor-secure-storage-plugin)
// FIX #2: JWT/refresh token KHÔNG còn nằm plaintext trong Preferences.
// Fallback chain: SecureStorage (native, encrypted) → Preferences (dev/browser only, có cảnh báo).
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { Preferences } from '@capacitor/preferences';

let secureAvailable = null; // lazy probe

async function probe() {
  if (secureAvailable !== null) return secureAvailable;
  try {
    await SecureStoragePlugin.keys();
    secureAvailable = true;
  } catch (_) {
    secureAvailable = false;
    console.warn('[secure] SecureStorage không khả dụng — fallback Preferences (CHỈ chấp nhận trong dev)');
  }
  return secureAvailable;
}

export const secureStore = {
  async set(key, value) {
    if (await probe()) {
      await SecureStoragePlugin.set({ key, value: String(value) });
    } else {
      await Preferences.set({ key: `insec_${key}`, value: String(value) });
    }
  },

  async get(key) {
    if (await probe()) {
      try {
        const { value } = await SecureStoragePlugin.get({ key });
        return value ?? null;
      } catch (_) { return null; } // key not found
    }
    const { value } = await Preferences.get({ key: `insec_${key}` });
    return value ?? null;
  },

  async remove(key) {
    if (await probe()) {
      try { await SecureStoragePlugin.remove({ key }); } catch (_) {}
    } else {
      await Preferences.remove({ key: `insec_${key}` });
    }
  },

  async isNativeSecure() { return probe(); }
};
