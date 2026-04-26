import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tracker.app',
  appName: 'Tracker',
  webDir: 'out',
  // Android-specific hardening:
  // - `androidScheme: 'https'` makes the WebView treat the app's origin as
  //   secure (https://localhost), which is required for full Service Worker
  //   support and unlocks the larger IndexedDB quota tier on modern Chrome.
  // - `webContentsDebuggingEnabled: false` disables Chrome DevTools remote
  //   inspection of release builds — leaving it on in shipped APKs is a
  //   minor information-disclosure risk.
  server: {
    androidScheme: 'https',
  },
  android: {
    webContentsDebuggingEnabled: false,
  },
};

export default config;
