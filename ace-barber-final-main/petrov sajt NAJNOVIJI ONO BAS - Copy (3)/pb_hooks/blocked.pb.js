/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/blocked.pb.js
// ═══════════════════════════════════════════════════════════════
// CRNA LISTA — odbijanje rezervacije blokiranom klijentu.
//
// Zakazivanje je anonimno (bez naloga), pa se klijent prepoznaje po broju
// telefona, mejlu ili oznaci uređaja. Lista stoji u kolekciji
// blocked_clients, a admin je održava iz dashboard-a (tab "Crna lista").
//
// OZNAKA UREĐAJA (device_id) — kako i zašto:
// Klijent je šalje u telu zahteva (vidi src/lib/device.ts). PocketBase
// nepoznato polje tiho ignoriše, pa se NE upisuje u termin — čita se samo
// ovde, iz e.requestInfo().body. Namerno tako: da oznake mušterija ne
// završe u kolekciji appointments, koju javni booking može da lista.
// Kada hook odbije nekoga po telefonu/mejlu, zapamti mu oznaku uređaja —
// pa ga pogodi i kad se vrati sa novim brojem i novim mejlom, sa istog
// uređaja. Briše se čišćenjem podataka sajta ili reinstalacijom
// aplikacije, zato telefon i mejl ostaju glavna provera.
//
// Provera MORA da bude na serveru: pravilo kolekcije ne može da gleda
// drugu kolekciju, a provera u frontendu se obilazi direktnim pozivom
// API-ja (curl). Ovaj hook hvata i sajt, i mobilnu aplikaciju, i curl.
//
// Admin NIJE blokiran — ako frizer hoće da ručno upiše termin takvom
// klijentu (dogovor telefonom), to mu i dalje radi. Isto važi i za
// blokiranje slotova ("BLOKIRANO") i za fiksne termine.
//
// NAPOMENA: handler se izvršava izolovano i ne vidi spoljni scope —
// zato require() ide UNUTAR handler-a (isto kao u main.pb.js).
//
// INSTALACIJA (oba koraka, redom):
//   1. pb_migrations/1791417600_create_blocked_clients.js
//        → /opt/pocketbase/pb_migrations/   (pravi kolekciju)
//   2. pb_hooks/blocked.pb.js + pb_hooks/lib_blocked.js
//        → /opt/pocketbase/pb_hooks/        (PocketBase sam učita)
//   Migracija se primeni pri restartu PocketBase-a.
//   Dok kolekcija ne postoji, hook ništa ne blokira (fail-open).
// ═══════════════════════════════════════════════════════════════

onRecordCreateRequest((e) => {
  const { findBlock, rememberDevice } = require(`${__hooks}/lib_blocked.js`);

  // ── Osoblje prolazi bez provere ──
  let isStaff = false;
  try {
    const auth = e.auth;
    if (auth) {
      const col = auth.collection().name;
      isStaff = col === "_superusers" || auth.getBool("is_admin") === true;
    }
  } catch (err) {
    isStaff = false;
  }
  if (isStaff) {
    e.next();
    return;
  }

  const phone = e.record.get("phone_number");
  const email = e.record.get("user_email");

  // Oznaka uređaja NIJE polje kolekcije — čita se iz tela zahteva.
  // Ako je nema (incognito, stari keš aplikacije), ostaje prazna i
  // provera se svodi na telefon i mejl.
  let device = "";
  try {
    device = String((e.requestInfo().body || {}).device_id || "");
  } catch (err) {
    device = "";
  }

  const hit = findBlock(phone, email, device);
  if (hit) {
    // Zapamti uređaj sa kog je došao pokušaj, da ne prođe sa drugim brojem.
    const learned = rememberDevice(hit, device);

    // U PocketBase Logs ostaje trag, da frizer vidi da je neko probao.
    $app
      .logger()
      .info(
        "Odbijena rezervacija — klijent je na crnoj listi",
        "phone",
        String(phone || ""),
        "email",
        String(email || ""),
        "blocked_id",
        hit.id,
        "novi_uredjaj",
        learned ? "da" : "ne",
      );

    throw new ForbiddenError(
      "Online zakazivanje za ove podatke nije moguće. Pozovite studio telefonom.",
      null,
    );
  }

  e.next();
}, "appointments");
