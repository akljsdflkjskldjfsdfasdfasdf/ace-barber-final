import type { CapacitorConfig } from "@capacitor/cli";

// ─────────────────────────────────────────────────────────────
// ACE BARBER STUDIO — native (Android + iOS) omotač oko sajta.
//
// Sajt se PAKUJE U APLIKACIJU (webDir: "dist"), ne učitava se sa
// interneta. Tako aplikacija ima svoj sadržaj (bitno za Apple
// review, smernica 4.2) i otvara se odmah, bez čekanja mreže.
//
// API i dalje ide na pravi server (https://ace-barberstudio.online).
// PocketBase tamo ima listu dozvoljenih origin-a i NE dozvoljava
// "https://localhost" (odakle WebView zove), pa bi običan fetch pao
// na CORS-u. Zato je uključen CapacitorHttp: on presreće fetch/XHR
// i šalje ga NATIVNO (Java/Swift), gde CORS ne postoji.
// ─────────────────────────────────────────────────────────────
const config: CapacitorConfig = {
  appId: "online.acebarberstudio.app",
  appName: "ACE Barber Studio",
  webDir: "dist",

  android: {
    // Bez ovoga bi WebView bio na http://localhost, pa bi Android
    // blokirao mešani sadržaj ka https API-ju.
    allowMixedContent: false,
  },

  server: {
    androidScheme: "https",
    iosScheme: "capacitor",
  },

  plugins: {
    // Zaobilazi CORS — sve mrežne pozive vodi kroz nativni HTTP.
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0a0a0a",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a0a0a",
      overlaysWebView: false,
    },
  },
};

export default config;
