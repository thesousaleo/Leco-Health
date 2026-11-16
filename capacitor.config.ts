import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.leco.health',
  appName: 'Leco Health',
  webDir: 'dist',
  backgroundColor: '#E9E5DF',
  android: { allowMixedContent: false },
};

export default config;
