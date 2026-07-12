import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Ulazak odozdo (px). */
  y?: number;
  /** Ulazak sa strane: negativno = sleva, pozitivno = zdesna (px). */
  x?: number;
  /** Početna veličina — npr. 0.9 za blagi zum-in. */
  scale?: number;
  /** Počinje mutno pa se izoštri. */
  blur?: boolean;
  once?: boolean;
}

/** Brz, elegantan scroll-reveal (≤ 0.8s) baziran na Framer Motion. */
export default function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
  x = 0,
  scale = 1,
  blur = false,
  once = true,
}: RevealProps) {
  const initial: Record<string, number | string> = { opacity: 0, y, x, scale };
  const inView: Record<string, number | string> = { opacity: 1, y: 0, x: 0, scale: 1 };
  if (blur) {
    initial.filter = "blur(10px)";
    inView.filter = "blur(0px)";
  }

  return (
    <motion.div
      className={className}
      initial={initial}
      whileInView={inView}
      viewport={{ once, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
