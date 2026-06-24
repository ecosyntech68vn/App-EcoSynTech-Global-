import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const useShims = process.env.CAP_BROWSER === '1' || process.env.VITE_BROWSER === '1';
const shimPath = path.resolve(__dirname, 'src/shims/capacitor-shims.js');

export default {
  build: {
    outDir: 'www',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/jspdf')) return 'pdf';
          if (id.includes('node_modules/chart.js')) return 'chart';
          if (id.includes('node_modules/qrcode-generator')) return 'qrcode';
          if (id.includes('node_modules/canvg') || id.includes('node_modules/html2canvas') || id.includes('node_modules/dompurify')) return 'vendor-heavy';
          if (id.includes('node_modules/idb-keyval') || id.includes('node_modules/alpinejs')) return 'core';
        }
      },
      external: ['canvg', 'html2canvas', 'dompurify']
    }
  },
  resolve: {
    alias: useShims ? [
      { find: '@capacitor/preferences', replacement: shimPath },
      { find: '@capacitor/network',     replacement: shimPath },
      { find: '@capacitor/app',         replacement: shimPath },
      { find: '@capacitor/camera',      replacement: shimPath },
      { find: '@capacitor/filesystem',  replacement: shimPath },
      { find: '@capacitor/geolocation', replacement: shimPath },
      { find: '@capacitor/local-notifications', replacement: shimPath },
      { find: '@capacitor/background-runner', replacement: shimPath },
      { find: '@capacitor-mlkit/barcode-scanning', replacement: shimPath },
      { find: '@aparajita/capacitor-biometric-auth', replacement: shimPath },
      { find: 'capacitor-secure-storage-plugin', replacement: shimPath }
    ] : []
  },
  server: { port: 5173, strictPort: true },
  test: {
    include: ['src/**/*.test.js'],
    environment: 'node'
  }
};
