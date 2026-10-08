// pb_hooks/lib_blocked.js
// ═══════════════════════════════════════════════════════════════
// CRNA LISTA KLIJENATA — provera da li je broj/mejl blokiran.
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

// Vraća zapis iz blocked_clients ako je klijent na listi, inače null.
//
// Namerno "fail-open": ako kolekcija ne postoji (migracija nije puštena)
// ili baza vrati grešku — rezervacija PROLAZI. Bolje da jedan blokiran
// klijent prođe, nego da celom studiju stane zakazivanje.
function findBlock(phone, email) {
  const p = normPhone(phone);
  const e = normEmail(email);

  if (p) {
    try {
      return $app.findFirstRecordByFilter(
        "blocked_clients",
        "phone_norm != '' && phone_norm = {:p}",
        { p: p },
      );
    } catch (err) {
      /* nije na listi (ili kolekcija ne postoji) — proveri još mejl */
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

  return null;
}

module.exports = { normPhone, normEmail, findBlock };
