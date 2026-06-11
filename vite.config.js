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
      output: { manualChunks: undefined },
      // canvg + html2canvas pull core-js — exclude (jsPDF works without them for our text-only reports)
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
  server: { port: 5173, strictPort: true }
};
