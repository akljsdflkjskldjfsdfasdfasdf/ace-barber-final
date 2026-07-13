// pb_hooks/main.pb.js
// ═══════════════════════════════════════════════════════════════
// ACE BARBER STUDIO — mejlovi pri rezervaciji + podsetnik (cron)
//
// NADOGRADNJA postojećeg fajla sa servera (/opt/pocketbase/pb_hooks/main.pb.js).
// Novo u ovoj verziji:
//   1. NE šalje mejl za BLOKIRANE termine (ranije: blokiranje odmora
//      = poplava mejlova berberu, po jedan za svaki blokiran slot!)
//   2. U svim mejlovima piše KOD KOG FRIZERA je termin (sad su trojica)
//
// Instalacija: prekopiraj ovaj fajl preko starog na serveru:
//   /opt/pocketbase/pb_hooks/main.pb.js
// PocketBase sam učita izmenu, restart nije potreban.
// ═══════════════════════════════════════════════════════════════

onRecordAfterCreateSuccess((e) => {
  var BARBER_EMAIL = "acestudions@gmail.com";

  const record = e.record;

  // Samo prave rezervacije — blokirani termini i BLOKIRANO zapisi se preskaču
  if (
    record.get("status") !== "booked" ||
    record.get("first_name") === "BLOKIRANO"
  ) {
    e.next();
    return;
  }

  const settings = $app.settings();

  const firstName = record.get("first_name");
  const lastName = record.get("last_name");
  const date = record.get("appointment_date");
  const time = record.get("appointment_time");
  const phone = record.get("phone_number");
  const userEmail = record.get("user_email");
  const barberName = record.get("barber_name") || "—";

  const senderAddress = settings.meta.senderAddress;
  const senderName = settings.meta.senderName || "Barbershop";

  // ── MEJL BERBERU ──
  try {
    const barberMsg = new MailerMessage();
    barberMsg.from = { address: senderAddress, name: senderName };
    barberMsg.to = [{ address: BARBER_EMAIL }];
    barberMsg.subject = `Nova rezervacija — ${barberName} · ${date} u ${time}`;
    barberMsg.html = `
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
      </div>`;
    $app.newMailClient().send(barberMsg);
    console.log("Email berberu poslat!");
  } catch (err) {
    console.error("Greška - email berberu:", err);
  }

  // ── MEJL KLIJENTU (POTVRDA) ──
  if (userEmail) {
    try {
      const msg = new MailerMessage();
      msg.from = { address: senderAddress, name: senderName };
      msg.to = [{ address: userEmail }];
      msg.subject = `Termin potvrđen — ${date} u ${time}`;
      msg.html = `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#111;color:#fff;padding:30px;border-radius:12px;">
          <h2 style="color:#fff;">Vaš termin je potvrđen ✂️</h2>
          <p style="color:#999;">Pozdrav, <strong style="color:#fff">${firstName}</strong>!</p>
          <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;margin:20px 0;">
            <p style="margin:8px 0;color:#999;">Frizer: <strong style="color:#fff">${barberName}</strong></p>
            <p style="margin:8px 0;color:#999;">Datum: <strong style="color:#fff">${date}</strong></p>
            <p style="margin:8px 0;color:#999;">Vreme: <strong style="color:#fff;font-size:20px;">${time}</strong></p>
          </div>
          <p style="color:#666;font-size:12px;">Ako ste sprečeni da dođete, javite nam se telefonom.</p>
        </div>`;
      $app.newMailClient().send(msg);
      console.log("Email klijentu poslat!");
    } catch (err) {
      console.error("Greška - email klijentu:", err);
    }
  }

  e.next();
}, "appointments");

// ── PODSETNIK (CRON, na svakih 15 min) — termini za tačno 4 sata ──
cronAdd("appointment_reminders", "*/15 * * * *", () => {
  const settings = $app.settings();
  const senderAddress = settings.meta.senderAddress;
  const senderName = settings.meta.senderName || "Barbershop";

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
      // Blokirani zapisi imaju status "blocked" pa ne ulaze ovde,
      // ali za svaki slučaj preskoči i BLOKIRANO
      if (record.get("first_name") === "BLOKIRANO") continue;

      const firstName = record.get("first_name");
      const userEmail = record.get("user_email");
      const date = record.get("appointment_date");
      const time = record.get("appointment_time");
      const barberName = record.get("barber_name") || "—";

      if (userEmail) {
        try {
          const msg = new MailerMessage();
          msg.from = { address: senderAddress, name: senderName };
          msg.to = [{ address: userEmail }];
          msg.subject = `Podsetnik — termin danas u ${time}`;
          msg.html = `
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
            </div>`;
          $app.newMailClient().send(msg);
          console.log("Podsetnik klijentu poslat:", userEmail);
        } catch (err) {
          console.error("Greška - podsetnik klijentu:", err);
        }
      }
    }
  } catch (err) {
    console.error("Greška - cron:", err);
  }
});
