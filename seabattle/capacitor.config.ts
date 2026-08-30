import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dilemma.seabattle',
  appName: 'Морской бой',
  webDir: 'dist',
  android: {
    // Комнаты в локальной сети работают по ws:// без шифрования.
    allowMixedContent: true,
    backgroundColor: '#03111F',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#03111F',
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
