// ─────────────────────────────────────────────────────────────
// Podešavanja koja važe SAMO u nativnoj aplikaciji (Android/iOS).
// Na sajtu se sve ovo preskače — funkcija odmah izađe.
// ─────────────────────────────────────────────────────────────
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

export async function initNative() {
  if (!Capacitor.isNativePlatform()) return;

  // Klasa na <html> — CSS njome gasi stvari koje na telefonu nemaju smisla
  // (kursor koji prati miš) i dodaje razmak za "zarez" i donju crtu.
  document.documentElement.classList.add("native-app");

  // Statusna traka: bele ikonice na crnoj pozadini, kao i sam sajt.
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#0a0a0a" });
    }
  } catch {
    // Neki uređaji ne dozvoljavaju promenu — nije razlog za pad aplikacije.
  }

  // Android dugme "nazad": ako ima šta da se zatvori, browser istorija to
  // reši; ako smo na početku, aplikacija se gasi (očekivano ponašanje).
  CapApp.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else CapApp.exitApp();
  });

  // Splash ostaje dok se sadržaj ne nacrta, pa nema belog bljeska.
  try {
    await SplashScreen.hide();
  } catch {
    // Splash je možda već sakriven — svejedno.
  }
}

/** Poziva callback kad se aplikacija vrati iz pozadine (za osvežavanje podataka). */
export function onAppResume(cb: () => void) {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handle = CapApp.addListener("appStateChange", ({ isActive }) => {
    if (isActive) cb();
  });
  return () => {
    handle.then((h) => h.remove()).catch(() => {});
  };
}
