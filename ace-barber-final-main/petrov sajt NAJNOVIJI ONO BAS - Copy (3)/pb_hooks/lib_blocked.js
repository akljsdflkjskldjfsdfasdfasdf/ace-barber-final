// pb_hooks/lib_blocked.js
// ═══════════════════════════════════════════════════════════════
// CRNA LISTA KLIJENATA — provera da li je broj/mejl/uređaj blokiran.
//
// VAŽNO — zašto je ovo poseban fajl, a ne funkcija u blocked.pb.js:
// PocketBase izvršava svaki hook u izolovanom JS scope-u, pa funkcije
// sa vrha hook fajla NISU vidljive unutar handler-a. Zajednički kod
// mora u modul koji se učita sa require() UNUTAR handler-a.
// Ime fajla NE sme da se završava na ".pb.js" — takve PocketBase
// sam učitava kao hook.
//
// Normalizacija mora da bude ISTA kao u src/lib/blocked.ts — admin
// upisuje `phone_norm` sa fronta, a ovde se po njemu traži.
// ═══════════════════════════════════════════════════════════════

// Koliko oznaka uređaja najviše pamtimo po jednom zapisu.
// Oznaku šalje klijent, pa može da je menja u nedogled — bez ovog
// ograničenja bi mogao da naduva polje i oteža bazu.
const MAX_DEVICES = 10;

// Svodi broj na jedan oblik: "+381 64 243-7639", "0642437639" i
// "00381642437639" daju isti rezultat ("0642437639").
function normPhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.indexOf("00") === 0) d = d.slice(2); // 00381… → 381…
  if (d.indexOf("381") === 0) d = "0" + d.slice(3); // 381 64… → 064…
  if (d.indexOf("0") !== 0) d = "0" + d; // 64… → 064…
  return d;
}

function normEmail(raw) {
  return String(raw || "").trim().toLowerCase();
}

// Oznaka uređaja dolazi sa klijenta, pa je perem: samo slova, cifre i
// crtica, 8–64 znaka. Sve ostalo tretiram kao da oznake nema.
function normDevice(raw) {
  const d = String(raw || "").trim();
  if (d.length < 8 || d.length > 64) return "";
  if (!/^[A-Za-z0-9-]+$/.test(d)) return "";
  return d;
}

// Vraća zapis iz blocked_clients ako je klijent na listi, inače null.
//
// Namerno "fail-open": ako kolekcija ne postoji (migracija nije puštena)
// ili baza vrati grešku — rezervacija PROLAZI. Bolje da jedan blokiran
// klijent prođe, nego da celom studiju stane zakazivanje.
function findBlock(phone, email, device) {
  const p = normPhone(phone);
  const e = normEmail(email);
  const d = normDevice(device);

  if (p) {
    try {
      return $app.findFirstRecordByFilter(
        "blocked_clients",
        "phone_norm != '' && phone_norm = {:p}",
        { p: p },
      );
    } catch (err) {
      /* nije na listi (ili kolekcija ne postoji) — proveri dalje */
    }
  }

  if (e) {
    try {
      return $app.findFirstRecordByFilter(
        "blocked_clients",
        "email != '' && email = {:e}",
        { e: e },
      );
    } catch (err) {
      /* nije na listi */
    }
  }

  // Uređaj se gleda POSLEDNJI — telefon i mejl su pouzdaniji.
  // Oznake su slučajni UUID-ovi, pa "sadrži" ne može slučajno da pogodi
  // tuđu (polje drži više oznaka, razdvojenih novim redom).
  if (d) {
    try {
      return $app.findFirstRecordByFilter(
        "blocked_clients",
        "device_ids != '' && device_ids ~ {:d}",
        { d: d },
      );
    } catch (err) {
      /* nije na listi */
    }
  }

  return null;
}

// Dopisuje oznaku uređaja na zapis koji je VEĆ pogođen po telefonu/mejlu.
// Tako se blokada "nauči" uređaj, pa isti čovek ne prođe kada sledeći put
// upiše drugi broj i drugi mejl.
//
// Greška se ovde namerno ćuti: ako pamćenje padne, rezervacija je ionako
// već odbijena — nema potrebe da zbog ovoga pukne ceo zahtev.
function rememberDevice(record, device) {
  const d = normDevice(device);
  if (!d) return false;

  try {
    const current = String(record.get("device_ids") || "");
    const list = current.split("\n").filter(function (x) {
      return x.length > 0;
    });

    if (list.indexOf(d) !== -1) return false; // već zapamćen
    if (list.length >= MAX_DEVICES) return false; // ne naduvavaj polje

    list.push(d);
    record.set("device_ids", list.join("\n"));
    $app.save(record);
    return true;
  } catch (err) {
    console.log("Crna lista: pamćenje uređaja nije uspelo:", err);
    return false;
  }
}

module.exports = { normPhone, normEmail, normDevice, findBlock, rememberDevice };
