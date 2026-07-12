import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.collectiveai.crownfall',
  appName: 'Crownfall: Twenty Realms',
  webDir: 'dist',
  backgroundColor: '#070813',
  ios: { contentInset: 'always', scrollEnabled: false },
  android: { backgroundColor: '#070813', allowMixedContent: false },
};

export default config;
