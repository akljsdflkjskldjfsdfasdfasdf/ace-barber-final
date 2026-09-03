// Pravi izvorne slike za ikonicu i splash ekran mobilne aplikacije.
// Pokretanje:  node scripts/generate-app-icons.cjs
// Zatim:       npx @capacitor/assets generate  (razvuče ih u sve veličine)
const sharp = require("sharp");
const path = require("path");

const BG = "#0a0a0a";      // ista crna kao sajt (--background u dark temi)
const GOLD = "#cea650";    // ista zlatna kao akcenat na sajtu
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";

// Znak: zlatni prsten, veliko "ACE", tanka linija i "BARBER STUDIO".
// `scale` pomera ceo crtež (1 = puna ikonica, manje = logo na splash-u).
function logo(size, scale = 1) {
  const c = size / 2;
  const r = (size * 0.44) * scale;
  return `
    <circle cx="${c}" cy="${c}" r="${r}" fill="none"
            stroke="${GOLD}" stroke-width="${size * 0.012 * scale}" opacity="0.9"/>
    <circle cx="${c}" cy="${c}" r="${r * 0.94}" fill="none"
            stroke="${GOLD}" stroke-width="${size * 0.004 * scale}" opacity="0.45"/>
    <text x="${c}" y="${c + size * 0.055 * scale}" text-anchor="middle"
          font-family="${SERIF}" font-weight="700"
          font-size="${size * 0.31 * scale}" fill="${GOLD}"
          letter-spacing="${size * 0.012 * scale}">ACE</text>
    <rect x="${c - size * 0.15 * scale}" y="${c + size * 0.10 * scale}"
          width="${size * 0.30 * scale}" height="${size * 0.006 * scale}"
          fill="${GOLD}" opacity="0.75"/>
    <text x="${c}" y="${c + size * 0.185 * scale}" text-anchor="middle"
          font-family="${SERIF}" font-weight="600"
          font-size="${size * 0.072 * scale}" fill="${GOLD}"
          letter-spacing="${size * 0.018 * scale}" opacity="0.9">BARBER</text>`;
}

const svg = (size, scale) => `<svg xmlns="http://www.w3.org/2000/svg"
  width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  ${logo(size, scale)}
</svg>`;

// Android adaptivna ikonica seče ivice u krug, pa prednji sloj mora
// da stane u sigurnu zonu (~66% širine) — zato manji `scale`.
const svgForeground = (size) => `<svg xmlns="http://www.w3.org/2000/svg"
  width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${logo(size, 0.62)}
</svg>`;

const svgFlat = (size, color) => `<svg xmlns="http://www.w3.org/2000/svg"
  width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${color}"/></svg>`;

const out = (f) => path.join(__dirname, "..", "assets", f);
const png = (svgStr, file) =>
  sharp(Buffer.from(svgStr)).png().toFile(out(file)).then((i) => console.log(`  ${file}  ${i.width}x${i.height}`));

(async () => {
  console.log("Pravim izvorne slike u assets/:");
  await png(svg(1024, 1), "icon.png");
  await png(svgForeground(1024), "icon-foreground.png");
  await png(svgFlat(1024, BG), "icon-background.png");
  // Splash je kvadrat 2732×2732 — seče se na svaki odnos stranica.
  await png(svg(2732, 0.34), "splash.png");
  await png(svg(2732, 0.34), "splash-dark.png");
  console.log("Gotovo.");
})();
