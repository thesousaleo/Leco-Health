import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.leco.health',
  appName: 'Leco Health',
  webDir: 'dist',
  backgroundColor: '#E9E5DF',
  android: {
    allowMixedContent: false,
    // Android 15 desenha o app por baixo das barras do sistema; 'force' reserva esse espaço.
    adjustMarginsForEdgeToEdge: 'force',
  },
};

export default config;
