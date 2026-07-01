const words = ["Preciznost", "Stil", "Tradicija", "Kvalitet"];

/** Velika pokretna traka sa rečima brenda — naizmenično pune i "outline" zlatne. */
export default function MarqueeBanner() {
  const sequence = [...words, ...words]; // dupliramo za besprekornu petlju

  return (
    <section className="overflow-hidden border-y border-border bg-background py-8 md:py-10">
      <div className="flex w-max animate-marquee-fast items-center">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center">
            {sequence.map((w, i) => (
              <span key={`${copy}-${i}`} className="flex items-center">
                <span
                  className={`whitespace-nowrap font-serif text-5xl font-bold uppercase italic tracking-tight md:text-7xl ${
                    i % 2 === 0 ? "text-foreground" : "text-stroke-gold"
                  }`}
                >
                  {w}
                </span>
                <span className="mx-6 text-2xl text-accent md:mx-10 md:text-4xl">
                  ✦
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
