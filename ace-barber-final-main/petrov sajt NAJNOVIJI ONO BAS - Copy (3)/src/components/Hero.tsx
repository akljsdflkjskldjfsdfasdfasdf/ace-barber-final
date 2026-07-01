import { useEffect, useMemo, useRef } from "react";
import Particles, { ParticlesProvider } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Engine, ISourceOptions } from "@tsparticles/engine";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ChevronDown } from "lucide-react";
import { scrollToId } from "../lib/lenis";
import Magnetic from "./Magnetic";

gsap.registerPlugin(ScrollTrigger);

// Mora biti stabilna referenca tokom celog životnog ciklusa aplikacije.
const particlesInit = async (engine: Engine) => {
  await loadSlim(engine);
};

export default function Hero() {
  const parallaxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = parallaxRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.to(el, {
        yPercent: 28,
        opacity: 0.25,
        ease: "none",
        scrollTrigger: {
          trigger: "#hero",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    });
    return () => ctx.revert();
  }, []);

  const options: ISourceOptions = useMemo(() => {
    // Na telefonu manje čestica i bez hover interakcije — brže i štedi bateriju
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    return {
      fullScreen: { enable: false },
      fpsLimit: 60,
      pauseOnOutsideViewport: true,
      particles: {
        number: { value: isMobile ? 26 : 55, density: { enable: true } },
        color: { value: "#c8a24a" },
        opacity: { value: { min: 0.1, max: 0.5 } },
        size: { value: { min: 1, max: 2.6 } },
        move: {
          enable: true,
          speed: 0.6,
          direction: "top",
          random: true,
          straight: false,
          outModes: { default: "out" },
        },
        links: { enable: false },
      },
      interactivity: isMobile
        ? undefined
        : {
            events: { onHover: { enable: true, mode: "repulse" } },
            modes: { repulse: { distance: 90, duration: 0.4 } },
          },
      detectRetina: true,
    };
  }, []);

  return (
    <section
      id="hero"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-muted/40 via-background to-background" />
      {/* Zlatni glow iza naslova */}
      <div className="hero-glow pointer-events-none absolute inset-0" />

      <ParticlesProvider init={particlesInit}>
        <Particles
          id="hero-particles"
          options={options}
          className="absolute inset-0"
        />
      </ParticlesProvider>

      <div
        ref={parallaxRef}
        className="relative z-10 mx-auto max-w-5xl px-6 text-center"
      >
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="mb-5 text-xs font-semibold uppercase tracking-[0.4em] text-accent"
        >
          Premium Barbershop
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-6xl font-bold tracking-tight text-foreground md:text-8xl"
        >
          ACE BARBER <span className="text-gradient-gold">STUDIO</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
          className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-2xl"
        >
          Where precision meets style. Timeless luxury.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Magnetic>
            <button
              onClick={() => scrollToId("booking")}
              className="btn-shine rounded-full bg-foreground px-10 py-4 text-lg font-semibold text-background shadow-xl transition-colors duration-300 hover:bg-accent hover:text-accent-foreground"
            >
              BOOK NOW
            </button>
          </Magnetic>
          <Magnetic strength={0.25}>
            <button
              onClick={() => scrollToId("services")}
              className="rounded-full border border-border px-10 py-4 text-lg font-semibold text-foreground transition-colors duration-300 hover:border-accent hover:text-accent"
            >
              Usluge
            </button>
          </Magnetic>
        </motion.div>
      </div>

      <button
        onClick={() => scrollToId("gallery")}
        aria-label="Skroluj dole"
        className="absolute bottom-10 left-1/2 z-10 -translate-x-1/2 text-muted-foreground transition-colors hover:text-accent"
      >
        <ChevronDown className="h-7 w-7 animate-bounce" />
      </button>
    </section>
  );
}
