// pb_hooks/recurring.pb.js
// ═══════════════════════════════════════════════════════════════
// FIKSNI TERMINI — pravljenje i otkazivanje serije JEDNIM zahtevom.
//
// Zašto postoji: nginx propušta 30 zahteva u minuti (api_zone). Kada je
// frontend pravio fiksni termin u petlji (12 upisa + provere), posle
// dvadesetak zahteva je dobijao 429 i pravljenje bi pucalo na pola.
// Isto je važilo i za otkazivanje — jedan DELETE po terminu.
//
// Sada frontend šalje JEDAN zahtev, a server odradi ceo posao odjednom:
// brže za korisnika i nema šanse da udari u rate limit.
//
// NAPOMENA: handleri se izvršavaju izolovano i ne vide spoljni scope —
// zato je provera prava ponovljena u obe rute (isto kao u privacy.pb.js).
// ═══════════════════════════════════════════════════════════════

// ── PRAVLJENJE SERIJE ──
// POST /api/recurring/create
// { barber, barberName, firstName, lastName, phone, email, weekday, time, weeks }
routerAdd("POST", "/api/recurring/create", (e) => {
  const auth = e.auth;
  if (!auth) return e.json(401, { error: "Niste prijavljeni." });

  let isSuper = false;
  let isAdmin = false;
  let isBoss = false;
  let myBarber = "";
  try {
    const col = auth.collection().name;
    isSuper = col === "_superusers";
    if (col === "users") {
      isAdmin = auth.getBool("is_admin") === true;
      isBoss = auth.getBool("is_boss") === true;
      myBarber = auth.getString("barber_id");
    }
  } catch (err) {
    return e.json(403, { error: "Nemate pravo pristupa." });
  }
  if (!isSuper && !isAdmin) {
    return e.json(403, { error: "Nemate pravo pristupa." });
  }

  const body = e.requestInfo().body || {};
  const barber = String(body.barber || "");
  const time = String(body.time || "");
  const firstName = String(body.firstName || "").trim();
  const weekday = Number(body.weekday);

  if (!barber || !time || !firstName) {
    return e.json(400, { error: "Nedostaju podaci (frizer, termin ili ime)." });
  }
  if (!(weekday >= 0 && weekday <= 6)) {
    return e.json(400, { error: "Neispravan dan u nedelji." });
  }
  // Frizer sme da menja samo svoj raspored; šef i superuser smeju sve.
  if (!isSuper && !isBoss && myBarber !== barber) {
    return e.json(403, { error: "Možete da menjate samo svoj raspored." });
  }

  let weeks = Number(body.weeks) || 12;
  if (weeks < 1) weeks = 1;
  if (weeks > 52) weeks = 52;

  // Prvo SLEDEĆE pojavljivanje tog dana, pa svakih 7 dana.
  // Sve u UTC sa 12:00 — datum ne može da odskoči zbog letnjeg vremena.
  const cursor = new Date();
  cursor.setUTCHours(12, 0, 0, 0);
  do {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  } while (cursor.getUTCDay() !== weekday);

  const dates = [];
  for (let i = 0; i < weeks; i++) {
    dates.push(cursor.toISOString().split("T")[0]);
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  try {
    // Zauzeti termini — jednim upitom za ceo opseg.
    const existing = $app.findRecordsByFilter(
      "appointments",
      "barber = {:b} && appointment_time = {:t} && appointment_date >= {:from} && appointment_date <= {:to}",
      "",
      500,
      0,
      { b: barber, t: time, from: dates[0], to: dates[dates.length - 1] },
    );
    const taken = {};
    for (const r of existing) {
      taken[r.get("appointment_date")] = true;
    }

    const collection = $app.findCollectionByNameOrId("appointments");
    const recurringId = "fix_" + barber + "_" + Date.now();
    let created = 0;

    for (const date of dates) {
      if (taken[date]) continue; // postojeća rezervacija se NIKAD ne pregazi
      const rec = new Record(collection);
      rec.set("first_name", firstName);
      rec.set("last_name", String(body.lastName || ""));
      rec.set("phone_number", String(body.phone || "") || "—");
      rec.set("appointment_date", date);
      rec.set("appointment_time", time);
      rec.set("status", "booked");
      rec.set("user_email", String(body.email || ""));
      rec.set("barber", barber);
      rec.set("barber_name", String(body.barberName || ""));
      rec.set("recurring_id", recurringId);
      $app.save(rec);
      created++;
    }

    return e.json(200, {
      created: created,
      skipped: dates.length - created,
      recurring_id: recurringId,
    });
  } catch (err) {
    console.error("Greška - pravljenje fiksnog termina:", err);
    return e.json(500, { error: "Greška pri upisu termina." });
  }
});

// ── OTKAZIVANJE SERIJE ──
// POST /api/recurring/cancel   { recurringId }
// Briše samo BUDUĆE termine — istorija ostaje netaknuta.
routerAdd("POST", "/api/recurring/cancel", (e) => {
  const auth = e.auth;
  if (!auth) return e.json(401, { error: "Niste prijavljeni." });

  let isSuper = false;
  let isAdmin = false;
  let isBoss = false;
  let myBarber = "";
  try {
    const col = auth.collection().name;
    isSuper = col === "_superusers";
    if (col === "users") {
      isAdmin = auth.getBool("is_admin") === true;
      isBoss = auth.getBool("is_boss") === true;
      myBarber = auth.getString("barber_id");
    }
  } catch (err) {
    return e.json(403, { error: "Nemate pravo pristupa." });
  }
  if (!isSuper && !isAdmin) {
    return e.json(403, { error: "Nemate pravo pristupa." });
  }

  const body = e.requestInfo().body || {};
  const recurringId = String(body.recurringId || "");
  if (!recurringId) {
    return e.json(400, { error: "Nedostaje oznaka serije." });
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const records = $app.findRecordsByFilter(
      "appointments",
      "recurring_id = {:r} && appointment_date >= {:d}",
      "",
      500,
      0,
      { r: recurringId, d: today },
    );

    if (records.length === 0) {
      return e.json(200, { deleted: 0 });
    }

    // Serija pripada jednom frizeru — proveri prava na prvom zapisu.
    const owner = records[0].get("barber");
    if (!isSuper && !isBoss && myBarber !== owner) {
      return e.json(403, { error: "Možete da menjate samo svoj raspored." });
    }

    let deleted = 0;
    for (const r of records) {
      $app.delete(r);
      deleted++;
    }

    return e.json(200, { deleted: deleted });
  } catch (err) {
    console.error("Greška - otkazivanje fiksnog termina:", err);
    return e.json(500, { error: "Greška pri otkazivanju serije." });
  }
});
