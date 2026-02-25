import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'af.market4u.app',
  appName: 'Market4U',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'market4u.af',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#060c18',
  },
  ios: {
    backgroundColor: '#060c18',
    preferredContentMode: 'mobile',
  },
};

export default config;
