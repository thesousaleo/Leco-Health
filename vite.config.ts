import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base './' → caminhos relativos, funciona no APK (Capacitor) e em qualquer hospedagem estática.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', target: 'es2020' },
});
