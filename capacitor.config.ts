import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.leco.health',
  appName: 'Leco Health',
  webDir: 'dist',
  backgroundColor: '#E9E5DF',
  android: {
    allowMixedContent: false,
    // Tela infinita: o app desenha por baixo das barras do sistema e o
    // MainActivity informa a altura delas ao app (variáveis --sat/--sab).
    adjustMarginsForEdgeToEdge: 'disable',
  },
  plugins: {
    StatusBar: { overlaysWebView: true },
  },
};

export default config;
