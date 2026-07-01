import { motion, useScroll, useSpring } from "framer-motion";

/** Tanka zlatna linija na vrhu koja prati napredak skrola. */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[120] h-[3px] origin-left bg-gradient-to-r from-accent/60 via-accent to-accent/60"
    />
  );
}
