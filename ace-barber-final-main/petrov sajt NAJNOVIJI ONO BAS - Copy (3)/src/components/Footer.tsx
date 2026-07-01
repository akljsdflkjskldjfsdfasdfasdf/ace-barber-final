import { MapPin, Phone, Clock } from "lucide-react";
import Reveal from "./Reveal";
import { SocialLinks } from "./SocialIcons";

export default function Footer() {
  const mapQuery = encodeURIComponent("Radnička 21 Novi Sad");
  const mapSrc = `https://maps.google.com/maps?q=${mapQuery}&output=embed`;

  return (
    <footer className="border-t border-border bg-muted/40 px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mb-8">
          <h4 className="mb-6 text-center font-serif text-2xl font-semibold text-foreground md:text-3xl">
            Our Location
          </h4>

          <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-border pb-[56.25%] shadow-sm">
            <iframe
              title="Location - Radnička 21"
              src={mapSrc}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>

          <p className="mt-2 text-center text-sm text-muted-foreground">
            If the map doesn't load automatically, please open it directly in
            Google Maps.
          </p>
        </Reveal>

        <div className="mb-12 grid gap-12 pb-12 text-center md:grid-cols-3">
          <Reveal>
            <h3 className="mb-4 flex items-center justify-center gap-2 text-xl font-bold text-foreground">
              <MapPin className="h-5 w-5 text-accent" />
              LOCATION
            </h3>
            <p className="leading-relaxed text-muted-foreground">
              Radnička 21
              <br />
              (Search on Google Maps)
            </p>
          </Reveal>

          <Reveal delay={0.08}>
            <h3 className="mb-4 flex items-center justify-center gap-2 text-xl font-bold text-foreground">
              <Clock className="h-5 w-5 text-accent" />
              WORKING HOURS
            </h3>
            <p className="leading-relaxed text-muted-foreground">
              Monday - Friday: 11:00 - 20:00
              <br />
              Saturday: 11:00 - 20:00
              <br />
              Sunday: 11:00 - 16:00
            </p>
          </Reveal>

          <Reveal delay={0.16}>
            <h3 className="mb-4 flex items-center justify-center gap-2 text-xl font-bold text-foreground">
              <Phone className="h-5 w-5 text-accent" />
              CONTACT
            </h3>
            <p className="leading-relaxed text-muted-foreground">
              Phone:{" "}
              <a href="tel:+381601434008" className="hover:text-accent hover:underline">
                (+381) 60 143-4008
              </a>
              <br />
              Email:{" "}
              <a
                href="mailto:acestudions@gmail.com"
                className="hover:text-accent hover:underline"
              >
                acestudions@gmail.com
              </a>
            </p>
            <SocialLinks className="mt-6 flex items-center justify-center gap-3" />
          </Reveal>
        </div>

        <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} ACE BARBER STUDIO. All rights reserved.
          <div className="mt-3">
            <a
              href="/beta"
              aria-label="Beta verzija"
              className="text-[10px] lowercase tracking-widest text-muted-foreground/15 transition-colors duration-300 hover:text-accent"
            >
              beta
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
