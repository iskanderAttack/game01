import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dilemma.prisoners',
  appName: 'Дилемма заключённого',
  webDir: 'dist',
  android: {
    // Комнаты в локальной сети работают по ws:// без шифрования.
    allowMixedContent: true,
    backgroundColor: '#07080F',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#07080F',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#00000000',
      overlaysWebView: true,
    },
  },
};

export default config;
