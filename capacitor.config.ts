import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rickylaserart.huggingpop',
  appName: 'Hugging Pop',
  webDir: 'www',
  // Serve packaged assets over https:// so Web Audio, localStorage and the
  // service-worker-free game behave like the production site.
  server: {
    androidScheme: 'https'
  },
  android: {
    // Match the game's dark loader background so there is no white flash
    // between the native splash and the WebView painting its first frame.
    backgroundColor: '#1a1330'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#1a1330',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
