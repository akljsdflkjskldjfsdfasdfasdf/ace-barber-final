import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";
import { Award, Star, Users } from "lucide-react";
import Reveal from "./Reveal";

const formatK = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K` : Math.round(v).toString();

interface Stat {
  icon: typeof Users;
  to: number;
  suffix?: string;
  decimals?: number;
  format?: (v: number) => string;
  label: string;
}

const stats: Stat[] = [
  { icon: Users, to: 1000, suffix: "+", format: formatK, label: "Zadovoljnih klijenata" },
  { icon: Award, to: 6, suffix: "+", label: "Godina iskustva" },
  { icon: Star, to: 5, label: "Prosečna ocena" },
];

function Counter({
  to,
  suffix = "",
  decimals = 0,
  format,
}: {
  to: number;
  suffix?: string;
  decimals?: number;
  format?: (v: number) => string;
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

  const text = format
    ? format(value)
    : value.toLocaleString("sr-RS", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <span ref={ref}>
      {text}
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

        <div className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-3 sm:gap-5">
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.label} delay={i * 0.1}>
                <div className="h-full rounded-3xl border border-border bg-card p-4 transition-colors hover:border-accent sm:p-7">
                  <Icon className="mx-auto mb-3 h-6 w-6 text-accent sm:mb-4 sm:h-7 sm:w-7" strokeWidth={1.6} />
                  <div className="font-serif text-3xl font-bold text-foreground sm:text-5xl">
                    <Counter to={s.to} suffix={s.suffix} decimals={s.decimals} format={s.format} />
                  </div>
                  <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
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
