// Crna lista klijenata — normalizacija podataka.
//
// VAŽNO: ISTA logika postoji i u pb_hooks/lib_blocked.js (server).
// Server je taj koji stvarno odbija rezervaciju, ovaj fajl samo upisuje
// `phone_norm` u istom formatu da bi se poklopili. Menjaš jedno — menjaj oba.

export interface BlockedClient {
  id: string;
  name: string;
  phone: string;
  phone_norm: string;
  email: string;
  reason: string;
  // Oznake uređaja sa kojih je pokušavao da zakaže, razdvojene novim redom.
  // Server ih sam dopisuje kad odbije pokušaj — admin ih ne upisuje ručno.
  device_ids: string;
  created: string;
}

// Koliko je uređaja zapamćeno na ovom zapisu.
export function deviceCount(item: BlockedClient): number {
  return String(item.device_ids || "").split("\n").filter(Boolean).length;
}

// Svodi broj telefona na jedan oblik, da "+381 64 243-7639",
// "0642437639" i "00381642437639" budu isti zapis.
export function normPhone(raw: string | undefined): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2); // 00381… → 381…
  if (d.startsWith("381")) d = "0" + d.slice(3); // 381 64… → 064…
  if (!d.startsWith("0")) d = "0" + d; // 64… → 064…
  return d;
}

export function normEmail(raw: string | undefined): string {
  return String(raw || "").trim().toLowerCase();
}

// Ime i prezime kako ih vidi admin — bez "+ Beard / + Wash" nastavka
// koji booking dopisuje na prezime.
export function cleanName(firstName?: string, lastName?: string): string {
  const last = String(lastName || "").replace(/\s*\+\s*(Beard|Wash)/gi, "");
  return `${String(firstName || "").trim()} ${last.trim()}`.trim();
}
