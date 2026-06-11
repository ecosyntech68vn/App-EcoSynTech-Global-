import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vn.ecosyntech.farmos',
  appName: 'EcoSynTech Farm OS',
  webDir: 'www',
  bundledWebRuntime: false,
  android: {
    // V3.1 FIX #3: tắt mixed content — cleartext HTTP chỉ qua network_security_config (LAN whitelist)
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  server: { androidScheme: 'https', cleartext: true },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#2E7D32',
      androidSplashResourceName: 'splash',
      showSpinner: false
    },
    StatusBar: { backgroundColor: '#2E7D32', style: 'LIGHT' },
    Camera: { androidScaleType: 'CENTER_CROP' },
    Geolocation: { permissions: ['location'] },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#2E7D32',
      sound: 'default'
    },
    BackgroundRunner: {
      label: 'vn.ecosyntech.farmos.sync',
      src: 'runners/sync-runner.js',
      event: 'sync',
      repeat: true,
      interval: 15,
      autoStart: true
    }
  }
};

export default config;
