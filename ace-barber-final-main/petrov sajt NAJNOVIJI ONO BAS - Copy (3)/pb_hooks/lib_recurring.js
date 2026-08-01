// pb_hooks/lib_recurring.js
// ═══════════════════════════════════════════════════════════════
// FIKSNI TERMINI — produžavanje serije.
//
// Admin napravi fiksni termin (npr. "svaki ponedeljak u 11h") za
// određen broj nedelja unapred. Ovaj modul dopunjava svaku seriju
// tako da horizont uvek ostaje pun — fiksni termin nikad ne istekne.
//
// Zašto poseban modul, a ne funkcija u main.pb.js: vidi lib_mail.js.
// ═══════════════════════════════════════════════════════════════

// Dokle unapred se drže fiksni termini (u nedeljama).
const RECURRING_HORIZON_WEEKS = 12;

function addDaysISO(iso, days) {
  // 12:00 UTC — bezbedno od pomeranja datuma zbog letnjeg računanja vremena
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function extendRecurringSeries() {
  const today = new Date().toISOString().split("T")[0];
  const horizon = addDaysISO(today, RECURRING_HORIZON_WEEKS * 7);

  const records = $app.findRecordsByFilter(
    "appointments",
    `recurring_id != "" && appointment_date >= "${today}"`,
    "appointment_date",
    2000,
    0,
  );

  // Poslednji zakazan datum po seriji + podaci za nove zapise
  const series = {};
  for (const r of records) {
    const key = r.get("recurring_id");
    const date = r.get("appointment_date");
    if (!series[key] || date > series[key].lastDate) {
      series[key] = {
        lastDate: date,
        time: r.get("appointment_time"),
        barber: r.get("barber"),
        barberName: r.get("barber_name"),
        firstName: r.get("first_name"),
        lastName: r.get("last_name"),
        phone: r.get("phone_number"),
        userEmail: r.get("user_email"),
      };
    }
  }

  const collection = $app.findCollectionByNameOrId("appointments");
  let created = 0;

  for (const key in series) {
    const s = series[key];
    let date = addDaysISO(s.lastDate, 7);

    while (date <= horizon) {
      // Ako je neko u međuvremenu zauzeo taj slot — preskoči tu nedelju.
      // Postojeća rezervacija se NIKAD ne pregazi.
      const taken = $app.findRecordsByFilter(
        "appointments",
        `appointment_date = "${date}" && appointment_time = "${s.time}" && barber = "${s.barber}"`,
        "",
        1,
        0,
      );

      if (taken.length === 0) {
        const rec = new Record(collection);
        rec.set("first_name", s.firstName);
        rec.set("last_name", s.lastName);
        rec.set("phone_number", s.phone);
        rec.set("appointment_date", date);
        rec.set("appointment_time", s.time);
        rec.set("status", "booked");
        rec.set("user_email", s.userEmail || "");
        rec.set("barber", s.barber);
        rec.set("barber_name", s.barberName);
        rec.set("recurring_id", key);
        $app.save(rec);
        created++;
      }

      date = addDaysISO(date, 7);
    }
  }

  if (created > 0) {
    console.log("Fiksni termini — dodato zapisa:", created);
  }
  return created;
}

module.exports = { extendRecurringSeries, RECURRING_HORIZON_WEEKS };
