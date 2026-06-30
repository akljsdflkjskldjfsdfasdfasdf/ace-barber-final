import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";
import { Star, Users } from "lucide-react";
import Reveal from "./Reveal";

interface Stat {
  icon: typeof Users;
  to: number;
  suffix?: string;
  decimals?: number;
  label: string;
}

const stats: Stat[] = [
  { icon: Users, to: 500, suffix: "+", label: "Zadovoljnih klijenata" },
  { icon: Star, to: 4.9, decimals: 1, label: "Prosečna ocena" },
];

function Counter({
  to,
  suffix = "",
  decimals = 0,
}: {
  to: number;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration: 1.6,
      ease: "easeOut",
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [inView, to]);

  return (
    <span ref={ref}>
      {value.toLocaleString("sr-RS", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

export default function About() {
  return (
    <section id="about" className="bg-background px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.4em] text-accent">
            O nama
          </p>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="font-serif text-4xl font-bold leading-tight text-foreground md:text-5xl">
            Stil koji ostavlja utisak
          </h2>
        </Reveal>

        <div className="mx-auto mt-12 grid max-w-md grid-cols-2 gap-5">
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.label} delay={i * 0.1}>
                <div className="rounded-3xl border border-border bg-card p-7 transition-colors hover:border-accent">
                  <Icon className="mx-auto mb-4 h-7 w-7 text-accent" strokeWidth={1.6} />
                  <div className="font-serif text-4xl font-bold text-foreground md:text-5xl">
                    <Counter to={s.to} suffix={s.suffix} decimals={s.decimals} />
                  </div>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
