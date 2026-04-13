// @ts-nocheck
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tracker.app.beta',
  appName: 'Tracker Beta',
  webDir: 'out',
  server: {
    url: 'https://my-expense-tracker-pearl.vercel.app',
    cleartext: true,
  },
};

export default config;
