import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dilemma.monopoly',
  appName: 'Монополия',
  webDir: 'dist',
  android: {
    // Комнаты в локальной сети работают по ws:// без шифрования.
    allowMixedContent: true,
    backgroundColor: '#0B1220',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#0B1220',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: { style: 'DARK', backgroundColor: '#00000000', overlaysWebView: true },
  },
};

export default config;
