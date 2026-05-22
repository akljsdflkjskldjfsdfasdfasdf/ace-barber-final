import { useEffect, useRef, useState } from "react";

// GORE U IMPORTIMA (Samo dodaj SoapDispenser)
import { Scissors, Droplets, Slice } from "lucide-react";

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
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 },
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-24 px-6 bg-neutral-950">
      <div className="max-w-7xl mx-auto">
        <h2
          className={`text-5xl md:text-6xl font-bold text-center mb-20 text-white transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          OUR SERVICES
        </h2>

        <div className="grid md:grid-cols-3 gap-12">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <div
                key={service.title}
                className={`group bg-black border border-neutral-800 p-10 hover:border-neutral-600 transition-all duration-500 ${
                  isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-10"
                }`}
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                <Icon
                  className="w-12 h-12 mb-6 text-neutral-400 group-hover:text-white transition-colors duration-300"
                  strokeWidth={1.5}
                />
                <h3 className="text-2xl font-bold mb-4 text-white">
                  {service.title}
                </h3>
                <p className="text-neutral-400 mb-6 leading-relaxed">
                  {service.description}
                </p>
                <p className="text-3xl font-bold text-white">{service.price}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
