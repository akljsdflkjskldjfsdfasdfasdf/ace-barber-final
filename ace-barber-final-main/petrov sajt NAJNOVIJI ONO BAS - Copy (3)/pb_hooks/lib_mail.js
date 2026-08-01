// pb_hooks/lib_mail.js
// ═══════════════════════════════════════════════════════════════
// Slanje mejla sa naloga KONKRETNOG frizera.
//
// VAŽNO — zašto je ovo poseban fajl, a ne funkcija u main.pb.js:
// PocketBase izvršava svaki hook/cron handler u izolovanom JS scope-u.
// Funkcije napisane na vrhu main.pb.js NISU vidljive unutar handler-a
// (dobija se "ReferenceError: ... is not defined"). Zajednički kod
// mora da stoji u modulu koji se učita sa require() UNUTAR handler-a.
//
// Ime fajla NE sme da se završava na ".pb.js" — takve fajlove
// PocketBase sam učitava kao hook.
// ═══════════════════════════════════════════════════════════════

// Studijski inbox — vidi SVE rezervacije, kod bilo kog frizera.
const STUDIO_EMAIL = "acestudions@gmail.com";

const MAIL_DIR = "/opt/pocketbase/pb_mail";
const MAIL_HELPER = MAIL_DIR + "/send_mail.py";

// Prvo pokušava sa naloga konkretnog frizera; ako frizer nema svoj nalog
// ili slanje padne — vraća se na globalni PocketBase SMTP.
// Vraća "barber" | "default" | "none" (korisno u testu).
function sendMail(opts) {
  const barberId = opts.barber || "";
  const to = (opts.to || []).filter(Boolean);
  if (to.length === 0 && !opts.notifyBarber) return "none";

  // 1) pokušaj preko frizerovog naloga
  if (barberId) {
    let payloadPath = "";
    try {
      payloadPath =
        MAIL_DIR +
        "/queue/mail-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2, 10) +
        ".json";

      $os.writeFile(
        payloadPath,
        JSON.stringify({
          barber: barberId,
          to: to,
          subject: opts.subject,
          html: opts.html,
          reply_to: opts.replyTo || "",
          notify_barber: !!opts.notifyBarber,
        }),
        0o600,
      );

      $os.cmd("python3", MAIL_HELPER, payloadPath).output();
      return "barber";
    } catch (err) {
      // Skript sam briše payload; ako je pao pre toga, počisti ovde
      // da lični podaci mušterije ne ostanu da leže na disku.
      try {
        $os.remove(payloadPath);
      } catch (_) {
        /* fajl je već obrisan */
      }
      console.log(
        "Frizerov SMTP nije uspeo (" + barberId + "), šaljem preko globalnog:",
        err,
      );
    }
  }

  // 2) fallback — globalni SMTP iz PocketBase podešavanja
  if (to.length === 0) return "none";
  try {
    const settings = $app.settings();
    const msg = new MailerMessage();
    msg.from = {
      address: settings.meta.senderAddress,
      name: settings.meta.senderName || "Barbershop",
    };
    msg.to = to.map(function (a) {
      return { address: a };
    });
    msg.subject = opts.subject;
    msg.html = opts.html;
    $app.newMailClient().send(msg);
    return "default";
  } catch (err) {
    console.error("Greška - slanje mejla:", err);
    return "none";
  }
}

module.exports = { sendMail, STUDIO_EMAIL };
