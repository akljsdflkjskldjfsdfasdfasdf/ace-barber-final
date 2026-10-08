// Oznaka uređaja (browsera / instalacije aplikacije).
//
// Služi SAMO za crnu listu: kada server odbije blokiranog klijenta, zapamti
// ovu oznaku, pa ga pogodi i kada se vrati sa novim brojem i novim mejlom —
// dok je na istom uređaju.
//
// DOKLE OVO DOPIRE (bez iluzija): briše se čišćenjem podataka sajta, ne
// postoji u incognito prozoru i menja se reinstalacijom aplikacije. Nije
// zamena za blokadu po telefonu/mejlu, nego dodatak koji hvata onoga ko
// samo promeni broj. Zato telefon/mejl ostaju glavna provera.
//
// PRIVATNOST: oznaka je slučajan broj bez ikakve veze sa korisnikom i ne
// upisuje se u termine — server je čuva samo u blocked_clients, koju vidi
// isključivo admin.

const KEY = "acebs_device_id";

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    /* padamo na zapis ispod */
  }
  // Rezerva za stare WebView-ove bez crypto.randomUUID
  return (
    "dev-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 12) +
    Math.random().toString(36).slice(2, 12)
  );
}

// Vraća oznaku ovog uređaja, pravi je pri prvom pozivu.
// Ako localStorage nije dostupan (incognito, blokirani podaci sajta),
// vraća "" — zakazivanje tada radi normalno, samo bez ove dodatne provere.
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && existing.length >= 8) return existing;
    const fresh = randomId();
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return "";
  }
}
