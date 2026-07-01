import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

// Slike koje preloader unapred učitava (galerija je odmah spremna pri ulasku)
const PRELOAD_IMAGES = [
  "/slike/1.jpeg",
  "/slike/2.jpeg",
  "/slike/3.jpeg",
  "/slike/4.jpeg",
  "/slike/5.jpeg",
  "/slike/7.jpeg",
  "/slike/8.jpeg",
  "/slike/9.jpeg",
];

const MIN_MS = 1600; // minimalno prikazivanje (da animacija "diše")
const MAX_MS = 4500; // sigurnosni limit — nikad ne visi duže od ovoga

const TITLE = "ACE BARBER STUDIO";

export default function Preloader({ onFinish }: { onFinish: () => void }) {
  const [pct, setPct] = useState(0);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    // Zaključaj skrol dok traje učitavanje
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let real = 0;
    const total = PRELOAD_IMAGES.length + 2; // slike + fontovi + window load
    const inc = () => {
      real++;
    };

    const fontTask = (document.fonts?.ready ?? Promise.resolve()).then(inc);
    const loadTask =
      document.readyState === "complete"
        ? Promise.resolve().then(inc)
        : new Promise<void>((r) =>
            window.addEventListener(
              "load",
              () => {
                inc();
                r();
              },
              { once: true },
            ),
          );
    const imgTasks = PRELOAD_IMAGES.map(
      (src) =>
        new Promise<void>((r) => {
          const im = new Image();
          im.onload = im.onerror = () => {
            inc();
            r();
          };
          im.src = src;
        }),
    );

    const start = Date.now();
    // Prikazani procenat glatko juri stvarni napredak (uvek blago raste)
    const timer = setInterval(() => {
      setPct((prev) => {
        const realPct = (real / total) * 100;
        const next = prev + (realPct - prev) * 0.16 + 0.5;
        return Math.min(next, realPct >= 100 ? 100 : 96);
      });
    }, 40);

    const allDone = async () => {
      await Promise.all([fontTask, loadTask, ...imgTasks]);
      const elapsed = Date.now() - start;
      if (elapsed < MIN_MS)
        await new Promise((r) => setTimeout(r, MIN_MS - elapsed));
    };
    const cap = new Promise<void>((r) => setTimeout(r, MAX_MS));

    Promise.race([allDone(), cap]).then(() => {
      clearInterval(timer);
      setPct(100);
      setTimeout(() => onFinishRef.current(), 500);
    });

    return () => {
      clearInterval(timer);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <motion.div
      exit={{ y: "-100%" }}
      transition={{ duration: 0.75, ease: [0.76, 0, 0.24, 1] }}
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-[#0a0a0a]"
    >
      {/* Naslov — slovo po slovo */}
      <div className="flex flex-wrap justify-center px-6">
        {TITLE.split("").map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 22, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.6, delay: 0.15 + i * 0.035, ease: "easeOut" }}
            className={`font-serif text-3xl font-bold tracking-tight sm:text-5xl md:text-6xl ${
              i >= TITLE.indexOf("STUDIO") ? "text-[#cfa348]" : "text-white"
            }`}
          >
            {ch === " " ? " " : ch}
          </motion.span>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="mt-4 text-[10px] font-semibold uppercase tracking-[0.5em] text-neutral-500"
      >
        Premium Barbershop
      </motion.p>

      {/* Zlatna linija napretka */}
      <div className="mt-10 h-px w-56 overflow-hidden bg-neutral-800 sm:w-72">
        <div
          className="h-full bg-gradient-to-r from-[#cfa348]/60 via-[#cfa348] to-[#cfa348]/60 transition-[width] duration-150 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Veliki procenat u uglu */}
      <div className="absolute bottom-8 right-8 select-none font-serif text-5xl font-bold italic text-[#cfa348]/90 tabular-nums md:text-7xl">
        {Math.round(pct)}%
      </div>
    </motion.div>
  );
}
