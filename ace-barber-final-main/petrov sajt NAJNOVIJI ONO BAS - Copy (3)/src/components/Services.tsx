import { Scissors, Droplets, Slice } from "lucide-react";
import { motion } from "framer-motion";
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

        <div className="grid gap-8 md:grid-cols-3">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <Reveal key={service.title} delay={index * 0.12}>
                <motion.div
                  whileHover={{ y: -8 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="group h-full rounded-3xl border border-border bg-card p-10 transition-colors duration-300 hover:border-accent"
                >
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
                  <p className="text-3xl font-bold text-foreground">
                    {service.price}
                  </p>
                </motion.div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
