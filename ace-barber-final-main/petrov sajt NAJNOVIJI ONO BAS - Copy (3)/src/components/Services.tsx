import { useRef, type ReactNode } from "react";
import { Scissors, Droplets, Slice } from "lucide-react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import Reveal from "./Reveal";

const services = [
  {
    icon: Scissors,
    title: "Haircut",
    description:
      "Timeless styles, crafted with precision and attention to detail",
    price: "1300 din",
  },
  {
    icon: Droplets,
    title: "Hair Wash",
    description:
      "Relaxing hair wash, performed with care and attention to detail",
    price: "FREE (with haircut)",
  },
  {
    icon: Slice,
    title: "Beard styling",
    description: "Expert shaping and maintenance for a perfectly groomed beard",
    price: "700 din",
  },
];

/** 3D kartica koja se blago naginje prateći kursor. */
function TiltCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 160, damping: 18 });
  const sry = useSpring(ry, { stiffness: 160, damping: 18 });

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * 10);
    rx.set(-py * 10);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: srx, rotateY: sry, transformStyle: "preserve-3d" }}
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="group h-full rounded-3xl border border-border bg-card p-10 transition-[border-color,box-shadow] duration-300 hover:border-accent hover:shadow-[0_20px_60px_-24px_hsl(var(--accent)/0.45)]"
    >
      {children}
    </motion.div>
  );
}

export default function Services() {
  return (
    <section id="services" className="bg-muted/40 px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.4em] text-accent">
            Šta nudimo
          </p>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mb-20 text-center font-serif text-5xl font-bold text-foreground md:text-6xl">
            OUR SERVICES
          </h2>
        </Reveal>

        <div
          className="grid gap-8 md:grid-cols-3"
          style={{ perspective: 1200 }}
        >
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <Reveal key={service.title} delay={index * 0.12}>
                <TiltCard>
                  <Icon
                    className="mb-6 h-12 w-12 text-muted-foreground transition-colors duration-300 group-hover:text-accent"
                    strokeWidth={1.5}
                  />
                  <h3 className="mb-4 font-serif text-2xl font-bold text-foreground">
                    {service.title}
                  </h3>
                  <p className="mb-6 leading-relaxed text-muted-foreground">
                    {service.description}
                  </p>
                  <p className="font-serif text-3xl font-bold text-accent">
                    {service.price}
                  </p>
                </TiltCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
