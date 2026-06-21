import { MapPin, Phone, Clock } from "lucide-react";

export default function Footer() {
  const mapQuery = encodeURIComponent("Radnička 21 Novi Sad");
  const mapSrc = `https://maps.google.com/maps?q=${mapQuery}&output=embed`;

  return (
    <footer className="bg-neutral-950 border-t border-neutral-900 py-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          {/* Centered and enlarged title */}
          <h4 className="text-white font-semibold mb-6 text-center text-2xl md:text-3xl">
            Our Location
          </h4>

          <div className="relative w-full max-w-3xl mx-auto pb-[56.25%] overflow-hidden rounded-lg shadow-sm">
            <iframe
              title="Location - Radnička 21"
              src={mapSrc}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 w-full h-full border-0"
            />
          </div>

          <p className="text-neutral-500 text-sm mt-2 text-center">
            If the map doesn't load automatically, please open it directly in
            Google Maps.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-12 text-center mb-12 pb-20 ">
          <div>
            <h3 className="text-white font-bold text-xl mb-4 flex items-center justify-center gap-2">
              <MapPin className="w-5 h-5" />
              LOCATION
            </h3>

            <p className="text-neutral-400 leading-relaxed ">
              Radnička 21
              <br />
              (Search on Google Maps)
            </p>
          </div>

          <div>
            <h3 className="text-white font-bold text-xl mb-4 flex items-center gap-2 justify-center">
              <Clock className="w-5 h-5" />
              WORKING HOURS
            </h3>
            <p className="text-neutral-400 leading-relaxed">
              Monday - Friday: 11:00 - 20:00
              <br />
              Saturday: 11:00 - 20:00
              <br />
              Sunday: 11:00 - 16:00
            </p>
          </div>

          <div>
            <h3 className="text-white font-bold text-xl mb-4 flex items-center gap-2 justify-center">
              <Phone className="w-5 h-5" />
              CONTACT
            </h3>
            <p className="text-neutral-400 leading-relaxed">
              Phone:{" "}
              <a href="tel:+381" className="hover:underline">
                (+381) 60 143-4008
              </a>
              <br />
              Email:{" "}
              <a href="mailto:info@elitecuts.com" className="hover:underline">
                acestudions@gmail.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
