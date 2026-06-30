import type Lenis from "lenis";

let instance: Lenis | null = null;

export const setLenis = (l: Lenis | null) => {
  instance = l;
};

/** Smooth scroll do elementa po id-u (sa fallback-om ako Lenis nije aktivan). */
export const scrollToId = (id: string) => {
  const target = id.startsWith("#") ? id : `#${id}`;
  if (instance) {
    instance.scrollTo(target, { offset: -72, duration: 1.1 });
  } else {
    document.querySelector(target)?.scrollIntoView({ behavior: "smooth" });
  }
};
