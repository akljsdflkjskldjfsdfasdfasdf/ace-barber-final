import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const images = [
  "/slike/1.jpeg",
  "/slike/2.jpeg",
  "/slike/3.jpeg",
  "/slike/4.jpeg",
  "/slike/5.jpeg",
  "/slike/7.jpeg",
  "/slike/8.jpeg",
  "/slike/9.jpeg",
];

const ImageCarousel = () => {
  // Dupliramo niz da bi se petlja vrtela beskonačno bez "skoka".
  const loop = [...images, ...images];
  const [selected, setSelected] = useState<string | null>(null);

  // Zatvaranje uvećane slike tasterom Escape.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <section
      id="gallery"
      className="relative overflow-hidden border-y border-border bg-background py-10"
    >
      {/* Fade na ivicama — slike se elegantno stapaju sa pozadinom */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent md:w-32" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent md:w-32" />
      <div className="flex w-max animate-marquee">
        {loop.map((imgUrl, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setSelected(imgUrl)}
            className="group mr-4 h-[340px] w-[255px] shrink-0 overflow-hidden rounded-2xl border border-border md:h-[440px] md:w-[330px]"
          >
            <img
              src={imgUrl}
              alt={`ACE Barber Studio galerija ${(index % images.length) + 1}`}
              loading={index < 4 ? "eager" : "lazy"}
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {/* LIGHTBOX — uvećana slika (marquee i dalje radi u pozadini) */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setSelected(null)}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Zatvori"
              className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full border border-white/20 text-white transition-colors hover:bg-white/10"
            >
              <X className="h-6 w-6" />
            </button>
            <motion.img
              src={selected}
              alt="Uvećana slika"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[88vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default ImageCarousel;
