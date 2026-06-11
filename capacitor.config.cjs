/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'vn.ecosyntech.farmos',
  appName: 'EcoSynTech Farm OS',
  webDir: 'www',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: true,
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
module.exports = config;
