// pb_hooks/main.pb.js
// ═══════════════════════════════════════════════════════════════
// ACE BARBER STUDIO — mejlovi pri rezervaciji + podsetnik (cron)
//
// Novo u ovoj verziji:
//   1. SVAKI FRIZER MOŽE DA ŠALJE SA SVOG NALOGA.
//      PocketBase drži samo jedan globalni SMTP, pa mejlove frizera
//      koji imaju svoj nalog šalje pb_mail/send_mail.py.
//      Ko nema svoj nalog (Marić, dok ne da lozinku) — ide preko
//      globalnog SMTP-a, tačno kao i do sada.
//   2. FIKSNI (PONAVLJAJUĆI) TERMINI — cron koji produžava serije,
//      da fiksni termin nikad ne "istekne".
//
// PAŽNJA pri izmenama: PocketBase izvršava svaki handler u izolovanom
// scope-u. Zajedničke funkcije NE smeju da stoje na vrhu ovog fajla —
// moraju u modul, pa require() UNUTAR handler-a (vidi lib_mail.js).
//
// Instalacija: prekopiraj pb_hooks/* u /opt/pocketbase/pb_hooks/
// PocketBase sam učita izmenu.
// ═══════════════════════════════════════════════════════════════

// ── MEJLOVI PRI REZERVACIJI ─────────────────────────────────────
onRecordAfterCreateSuccess((e) => {
  const { sendMail, STUDIO_EMAIL } = require(`${__hooks}/lib_mail.js`);

  const record = e.record;

  // Preskoči: blokirane termine, odmor, i zapise fiksne serije.
  // Fiksni termin se pravi za više nedelja odjednom — bez ovog uslova
  // berberu bi stiglo 12 mejlova za jednog istog stalnog mušteriju.
  if (
    record.get("status") !== "booked" ||
    record.get("first_name") === "BLOKIRANO" ||
    record.get("recurring_id")
  ) {
    e.next();
    return;
  }

  const firstName = record.get("first_name");
  const lastName = record.get("last_name");
  const date = record.get("appointment_date");
  const time = record.get("appointment_time");
  const phone = record.get("phone_number");
  const userEmail = record.get("user_email");
  const barberId = record.get("barber") || "";
  const barberName = record.get("barber_name") || "—";

  // ── MEJL BERBERU ──
  // Ide na studijski inbox; ako frizer ima svoj nalog, send_mail.py
  // doda i njegovu ličnu adresu (notifyBarber).
  sendMail({
    barber: barberId,
    to: [STUDIO_EMAIL],
    notifyBarber: true,
    replyTo: userEmail || "",
    subject: `Nova rezervacija — ${barberName} · ${date} u ${time}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#111;color:#fff;padding:30px;border-radius:12px;">
        <h2 style="color:#fff;border-bottom:1px solid #333;padding-bottom:16px;">Nova rezervacija</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#999;">Frizer:</td><td style="color:#fff;font-weight:bold;">${barberName}</td></tr>
          <tr><td style="padding:8px 0;color:#999;">Klijent:</td><td style="color:#fff;font-weight:bold;">${firstName} ${lastName}</td></tr>
          <tr><td style="padding:8px 0;color:#999;">Telefon:</td><td style="color:#fff;">${phone}</td></tr>
          <tr><td style="padding:8px 0;color:#999;">Email:</td><td style="color:#fff;">${userEmail || "—"}</td></tr>
          <tr><td style="padding:8px 0;color:#999;">Datum:</td><td style="color:#fff;">${date}</td></tr>
          <tr><td style="padding:8px 0;color:#999;">Vreme:</td><td style="color:#fff;font-weight:bold;font-size:18px;">${time}</td></tr>
        </table>
      </div>`,
  });

  // ── MEJL KLIJENTU (POTVRDA) ──
  if (userEmail) {
    sendMail({
      barber: barberId,
      to: [userEmail],
      subject: `Termin potvrđen — ${date} u ${time}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#111;color:#fff;padding:30px;border-radius:12px;">
          <h2 style="color:#fff;">Vaš termin je potvrđen ✂️</h2>
          <p style="color:#999;">Pozdrav, <strong style="color:#fff">${firstName}</strong>!</p>
          <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;margin:20px 0;">
            <p style="margin:8px 0;color:#999;">Frizer: <strong style="color:#fff">${barberName}</strong></p>
            <p style="margin:8px 0;color:#999;">Datum: <strong style="color:#fff">${date}</strong></p>
            <p style="margin:8px 0;color:#999;">Vreme: <strong style="color:#fff;font-size:20px;">${time}</strong></p>
          </div>
          <p style="color:#666;font-size:12px;">Ako ste sprečeni da dođete, javite nam se telefonom.</p>
        </div>`,
    });
  }

  e.next();
}, "appointments");

// ── PODSETNIK (CRON, na svakih 15 min) — termini za tačno 4 sata ──
cronAdd("appointment_reminders", "*/15 * * * *", () => {
  const { sendMail } = require(`${__hooks}/lib_mail.js`);

  const now = new Date();
  const target = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  const dateStr = target.toISOString().split("T")[0];
  const hh = String(target.getHours()).padStart(2, "0");
  const mm = String(target.getMinutes()).padStart(2, "0");
  const timeStr = `${hh}:${mm}`;

  try {
    const records = $app.findRecordsByFilter(
      "appointments",
      `appointment_date = "${dateStr}" && appointment_time = "${timeStr}" && status = "booked"`,
      "",
      100,
      0,
    );

    for (const record of records) {
      if (record.get("first_name") === "BLOKIRANO") continue;

      const firstName = record.get("first_name");
      const userEmail = record.get("user_email");
      const date = record.get("appointment_date");
      const time = record.get("appointment_time");
      const barberId = record.get("barber") || "";
      const barberName = record.get("barber_name") || "—";

      if (!userEmail) continue;

      sendMail({
        barber: barberId,
        to: [userEmail],
        subject: `Podsetnik — termin danas u ${time}`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#111;color:#fff;padding:30px;border-radius:12px;">
              <h2 style="color:#fff;">Podsetnik ⏰</h2>
              <p style="color:#999;">Pozdrav, <strong style="color:#fff">${firstName}</strong>!</p>
              <p style="color:#ccc;">Vaš termin je za <strong style="color:#fff">4 sata</strong>.</p>
              <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;margin:20px 0;">
                <p style="margin:8px 0;color:#999;">Frizer: <strong style="color:#fff">${barberName}</strong></p>
                <p style="margin:8px 0;color:#999;">Datum: <strong style="color:#fff">${date}</strong></p>
                <p style="margin:8px 0;color:#999;">Vreme: <strong style="color:#fff;font-size:24px;">${time}</strong></p>
              </div>
              <p style="color:#666;font-size:12px;">Ako ste sprečeni, pozovite nas telefonom.</p>
            </div>`,
      });
    }
  } catch (err) {
    console.error("Greška - cron podsetnik:", err);
  }
});

// ── FIKSNI TERMINI: produžavanje serije (CRON, svaki dan u 03:30) ──
cronAdd("recurring_extend", "30 3 * * *", () => {
  try {
    const { extendRecurringSeries } = require(`${__hooks}/lib_recurring.js`);
    extendRecurringSeries();
  } catch (err) {
    console.error("Greška - cron fiksni termini:", err);
  }
});
