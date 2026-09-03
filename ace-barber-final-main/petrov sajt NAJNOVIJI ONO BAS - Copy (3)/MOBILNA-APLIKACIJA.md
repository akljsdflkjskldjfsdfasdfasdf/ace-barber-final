# ACE Barber Studio — mobilna aplikacija

Sajt je upakovan u pravu Android i iOS aplikaciju preko **Capacitor**-a.
Sadržaj sajta se **pakuje u aplikaciju** (ne učitava se sa interneta), a
termini idu na postojeći PocketBase server `https://ace-barberstudio.online`.

- **ID aplikacije (paket):** `online.acebarberstudio.app`
- **Ime:** ACE Barber Studio
- **Verzija:** 1.0.0 (versionCode 1)

---

## 1. Zašto ovo radi, a ranije nije

PocketBase na serveru ima **listu dozvoljenih origin-a** — propušta samo
`ace-barberstudio.online` i `ace-barberstudio.netlify.app`. Mobilna
aplikacija zove server sa origin-a `https://localhost`, koji **nije** na
toj listi, pa bi svaki zahtev pao na CORS grešci i aplikacija bi bila
prazna.

Rešeno je uključivanjem **CapacitorHttp** (`capacitor.config.ts`): on
presreće `fetch` i šalje zahtev **nativno** (Java/Swift), a ne kroz
browser. Nativni poziv ne šalje `Origin` zaglavlje, pa CORS provere
uopšte nema. Provereno: server normalno odgovara na zahtev bez `Origin`-a.

**Server ne treba dirati.**

### Jedino ograničenje

Realtime (trenutno osvežavanje admin panela) ide preko `EventSource`, a
njega CapacitorHttp **ne** presreće — ostaje na `https://localhost` i
padne na CORS-u. Zato u aplikaciji admin panel **anketira server na 30
sekundi** i osveži se odmah čim se aplikacija vrati iz pozadine. Na
sajtu je i dalje pravi realtime, ništa se nije promenilo.

Ako hoćeš pravi realtime i u aplikaciji, na serveru dodaj origin-e u
PocketBase (u `--origins` listu):

```
https://localhost,capacitor://localhost
```

---

## 2. Ulaz u admin panel iz aplikacije

U aplikaciji nema adresne linije (pa ni tajne rute `/petarnikola`) ni
tastature (pa ni `Ctrl+Shift+Z`).

➡️ **5 brzih dodira u donjem levom uglu ekrana** otvara admin prijavu.

---

## 3. Fajlovi koji se prave

| Fajl | Čemu služi |
|---|---|
| `android/app/build/outputs/apk/release/app-release.apk` | direktna instalacija na telefon (testiranje) |
| `android/app/build/outputs/bundle/release/app-release.aab` | **ovo se šalje na Play Store** |
| `ios/` | Xcode projekat — build zahteva Mac |

### Komande

```bash
npm run android:apk    # napravi APK
npm run android:aab    # napravi AAB za Play Store
npm run mobile:sync    # samo osveži sadržaj u native projektima
npm run ios:open       # otvori Xcode projekat (samo na Mac-u)
```

Ikonice se prave sa:
```bash
node scripts/generate-app-icons.cjs
npx @capacitor/assets generate --iconBackgroundColor "#0a0a0a" --splashBackgroundColor "#0a0a0a"
```

---

## 4. ⚠️ Ključ za potpisivanje — NAJVAŽNIJE

Fajl `android/ace-barber-release.keystore` i lozinka u
`android/keystore.properties` **nisu na GitHub-u** (namerno, to je tajna).

**Napravi kopiju oba fajla na bar dva mesta** (npr. USB + Google Drive).
Bez njih ne možeš da objaviš izmenu aplikacije pod istim imenom.

> Ako uključiš **Play App Signing** (Google predlaže sam, prihvati),
> Google čuva pravi ključ, a ovaj tvoj postaje samo „upload ključ" koji
> Google može da resetuje ako ga izgubiš. Zato uključi Play App Signing.

---

## 5. Google Play Store — korak po korak

1. **Nalog** — [play.google.com/console](https://play.google.com/console),
   jednokratno **25 USD**. Potvrda identiteta (lična karta) traje
   **1–3 dana**.
2. **Napravi aplikaciju** — Create app → ime, srpski jezik, „App", besplatna.
3. **Popuni obavezno:**
   - Opis (kratki + dugi), ikonica 512×512, feature grafika 1024×500
   - **Najmanje 2 slike ekrana** telefona (screenshot iz aplikacije)
   - **Politika privatnosti** — mora javni link (vidi tačku 7)
   - **Data safety** — prijavi da se skupljaju: ime, telefon, email
     (za rezervaciju termina), da se šalju šifrovano i da korisnik može
     da traži brisanje
   - Content rating upitnik, ciljna grupa (18+ ili „svi uzrasti")
4. **Otpremi** `app-release.aab` u Production → Create new release.
5. ⚠️ **Ako ti je nalog LIČNI (otvoren posle 13.11.2023.):** Google traži
   **zatvoreni test sa 12 testera koji drže aplikaciju 14 dana zaredom**
   pre nego što uopšte možeš na produkciju. Ovo je najduži deo posla.
   - *Zaobilaženje:* otvori nalog kao **firma/organizacija** (treba
     registrovana firma i D-U-N-S broj) — tada ovo pravilo **ne važi**.
6. **Pregled** (review): obično **1–7 dana** za prvu aplikaciju.

**Ukupno:**
- lični nalog: **~3–4 nedelje** (zbog 14-dnevnog testa)
- nalog firme: **~5–10 dana**

---

## 6. Apple App Store — korak po korak

⚠️ **Za iOS build je obavezan Mac.** Windows ne može da napravi `.ipa`.

**Tri opcije:**
- **Mac** (Mac mini je najjeftiniji)
- **Codemagic** — build u oblaku, bez Mac-a. U projektu je već
  `codemagic.yaml`, treba samo povezati GitHub repo i Apple nalog.
  Besplatno 500 minuta mesečno (jedan build ~10 min). **Preporuka.**
- MacInCloud / iznajmljeni Mac (~30 USD mesečno)

**Koraci:**
1. **Apple Developer Program** — [developer.apple.com](https://developer.apple.com/programs/),
   **99 USD godišnje**. Odobrenje: **1–2 dana** za pojedinca,
   **1–2 nedelje** za firmu (treba D-U-N-S broj).
2. **App Store Connect** → My Apps → **+** → nova aplikacija,
   Bundle ID `online.acebarberstudio.app`.
3. **Build:** na Mac-u `npm run mobile:sync`, pa `npx cap open ios`,
   pa u Xcode-u Product → Archive → Distribute. Ili preko Codemagic-a.
4. **Popuni:** opis, ključne reči, **slike ekrana za 6.7" i 6.1" iPhone**,
   politika privatnosti, **App Privacy** upitnik (ime, telefon, email —
   „vezano za korisnika", za funkcionalnost aplikacije).
5. **Pošalji na pregled.** Apple review: obično **24–48 sati**, prva
   aplikacija ponekad **3–5 dana**.

**Ukupno: ~1–2 nedelje.**

### ⚠️ Rizik kod Apple-a — smernica 4.2 „Minimum Functionality"

Apple odbija aplikacije koje su „samo sajt u ramu". Kod nas je to
ublaženo: sadržaj je **upakovan u aplikaciju**, ima nativni splash,
statusnu traku i dugme nazad. To je obično dovoljno za servis sa pravom
funkcijom (rezervacija termina).

Ako ipak odbiju, najjači potez je dodati **push notifikacije**
(podsetnik „sutra u 14:00 imaš termin") — to je funkcija koju sajt ne
može da ima i skoro uvek reši ovu zamerku.

---

## 7. Politika privatnosti (obavezna za obe prodavnice)

Treba javna stranica sa tekstom: koji se podaci skupljaju (ime, telefon,
email), zašto (rezervacija termina), koliko se čuvaju, i kontakt za
brisanje. Može kao nova stranica na sajtu, npr.
`ace-barberstudio.online/privatnost`.

---

## 8. Nova verzija aplikacije

1. Izmeni sajt kao i uvek.
2. U `android/app/build.gradle` podigni `versionCode` (2, 3, 4…) i
   `versionName` ("1.0.1").
3. `npm run android:aab` → otpremi novi `.aab`.
4. Za iOS isto, uz `CFBundleVersion` u Xcode-u.

> Sitne izmene sadržaja **ne mogu** da idu bez nove verzije, jer je sajt
> upakovan u aplikaciju. To je svesna odluka — tako aplikacija radi i
> bez interneta do trenutka rezervacije, i lakše prolazi Apple review.
