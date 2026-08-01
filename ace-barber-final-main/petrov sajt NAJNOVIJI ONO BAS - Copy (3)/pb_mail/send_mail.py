#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════
# ACE BARBER STUDIO — slanje mejla sa naloga KONKRETNOG frizera
#
# Zašto postoji: PocketBase ume da drži samo JEDAN globalni SMTP nalog.
# Nanić (i kasnije Marić) šalju sa svog Gmail-a, pa se ti mejlovi
# šalju mimo PocketBase mailer-a — preko ovog skripta.
#
# Poziva ga pb_hooks/main.pb.js ovako:
#     python3 send_mail.py /putanja/do/payload.json
#
# payload.json:
#   {
#     "barber":        "barber-2",         // koji nalog koristiti
#     "to":            ["a@b.com"],        // primaoci
#     "subject":       "...",
#     "html":          "<div>...</div>",
#     "notify_barber": true                // dodaj i frizerovu adresu iz accounts.json
#   }
#
# Nalozi (sa lozinkama) stoje u accounts.json — chmod 600, van git-a.
#
# Izlazni kod:
#   0  poslato
#   3  nema naloga za tog frizera  →  hook šalje preko globalnog SMTP-a
#   ostalo = greška                →  hook šalje preko globalnog SMTP-a
# ═══════════════════════════════════════════════════════════════

import json
import os
import ssl
import sys
import smtplib
from email.message import EmailMessage

CONFIG = "/opt/pocketbase/pb_mail/accounts.json"


def main() -> int:
    if len(sys.argv) < 2:
        print("upotreba: send_mail.py <payload.json>", file=sys.stderr)
        return 2

    payload_path = sys.argv[1]
    try:
        with open(payload_path, encoding="utf-8") as f:
            payload = json.load(f)
    except (OSError, ValueError) as err:
        print(f"payload nečitljiv: {err}", file=sys.stderr)
        return 2
    finally:
        # Payload sadrži lične podatke mušterije — briše se odmah.
        try:
            os.remove(payload_path)
        except OSError:
            pass

    try:
        with open(CONFIG, encoding="utf-8") as f:
            accounts = json.load(f).get("accounts", {})
    except (OSError, ValueError) as err:
        print(f"accounts.json nečitljiv: {err}", file=sys.stderr)
        return 3

    acc = accounts.get(payload.get("barber") or "")
    if not acc or not acc.get("username") or not acc.get("password"):
        # Frizer nema svoj nalog (npr. Marić dok ne da lozinku) — fallback.
        print("nema naloga za tog frizera", file=sys.stderr)
        return 3

    recipients = payload.get("to") or []
    if isinstance(recipients, str):
        recipients = [recipients]
    recipients = [a.strip() for a in recipients if a and a.strip()]

    # Obaveštenje o rezervaciji ide i frizeru lično, pored studijskog inboxa.
    if payload.get("notify_barber") and acc.get("notify"):
        if acc["notify"] not in recipients:
            recipients.append(acc["notify"])

    if not recipients:
        print("nema primalaca", file=sys.stderr)
        return 4

    msg = EmailMessage()
    msg["From"] = f'{acc.get("name", "Ace Studio")} <{acc["username"]}>'
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = payload.get("subject", "")
    if payload.get("reply_to"):
        msg["Reply-To"] = payload["reply_to"]

    # Plain-text deo za klijente koji ne prikazuju HTML.
    msg.set_content(payload.get("text") or "Ovaj mejl se najbolje vidi u HTML formatu.")
    msg.add_alternative(payload.get("html", ""), subtype="html")

    host = acc.get("host", "smtp.gmail.com")
    port = int(acc.get("port", 587))
    # Gmail prikazuje app lozinku sa razmacima, a očekuje je bez njih.
    password = acc["password"].replace(" ", "")
    context = ssl.create_default_context()

    try:
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=30, context=context)
        else:
            server = smtplib.SMTP(host, port, timeout=30)
            server.starttls(context=context)
        with server:
            server.login(acc["username"], password)
            server.send_message(msg)
    except Exception as err:  # noqa: BLE001 — svaka greška vodi na fallback
        print(f"slanje palo ({type(err).__name__}): {err}", file=sys.stderr)
        return 5

    print(f"poslato sa {acc['username']} -> {', '.join(recipients)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
