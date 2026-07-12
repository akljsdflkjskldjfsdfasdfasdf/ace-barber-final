import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * Custom kursor — zlatne makaze koje prate miš.
 * Sečiva su blago otvorena; preko dugmeta/linka se otvore šire ("spremne za
 * šišanje"), a na klik se sklope uz kratki zlatni prasak — kao da seku.
 * Aktivan samo na uređajima sa mišem — na telefonu se ne prikazuje.
 */
export default function CustomCursor() {
  const [enabled] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches,
  );
  const [hovering, setHovering] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pressed, setPressed] = useState(false);
  // Svaki klik dobija novi id → burst animacija se restartuje kroz React key
  const [snip, setSnip] = useState<{ id: number; x: number; y: number } | null>(
    null,
  );

  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);
  const ringX = useSpring(mouseX, { stiffness: 300, damping: 28, mass: 0.6 });
  const ringY = useSpring(mouseY, { stiffness: 300, damping: 28, mass: 0.6 });

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.classList.add("has-custom-cursor");

    const move = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      setVisible(true);
      const t = e.target as Element | null;
      setHovering(
        !!t?.closest("a, button, [role='button'], input, textarea, select, label"),
      );
    };
    const leave = () => setVisible(false);
    const down = (e: MouseEvent) => {
      setPressed(true);
      setSnip({ id: Date.now(), x: e.clientX, y: e.clientY });
    };
    const up = () => setPressed(false);

    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      document.documentElement.classList.remove("has-custom-cursor");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      document.documentElement.removeEventListener("mouseleave", leave);
    };
  }, [enabled, mouseX, mouseY]);

  if (!enabled) return null;

  // Ugao otvaranja sečiva: klik = sklopljene (0°), preko dugmeta = širom otvorene
  const angle = pressed ? 0 : hovering ? 26 : 14;
  const bladeSpring = { type: "spring" as const, stiffness: 700, damping: 22 };
  // Rotacija oko šrafa (pivot tačke) makaza — u koordinatama viewBox-a
  const pivotOrigin = {
    transformOrigin: "22px 24px",
    transformBox: "view-box",
  } as const;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[400]"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s" }}
    >
      {/* Prsten koji kasni za makazama */}
      <motion.div
        style={{ x: ringX, y: ringY }}
        className="absolute left-0 top-0"
      >
        <motion.div
          animate={{
            scale: pressed ? 0.7 : hovering ? 2.1 : 1,
            opacity: hovering ? 0.9 : 0.5,
          }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent"
        />
      </motion.div>

      {/* MAKAZE — vrhovi sečiva stoje na poziciji miša */}
      <motion.div
        style={{ x: mouseX, y: mouseY }}
        className="absolute left-0 top-0"
      >
        <motion.svg
          width="44"
          height="44"
          viewBox="0 0 44 44"
          className="-translate-x-1/2 -translate-y-[5px] drop-shadow-[0_1px_4px_rgba(0,0,0,0.35)]"
          animate={{ rotate: pressed ? -16 : 0, scale: pressed ? 0.92 : 1 }}
          transition={{ type: "spring", stiffness: 480, damping: 20 }}
        >
          {/* Polovina A — sečivo ide levo kad su otvorene, drška desno */}
          <motion.g animate={{ rotate: -angle }} transition={bladeSpring} style={pivotOrigin}>
            <path d="M22 24 L20 6.5 Q22 3 24 6.5 Z" fill="hsl(var(--accent))" />
            <circle
              cx="22"
              cy="32.5"
              r="4.4"
              fill="none"
              stroke="hsl(var(--accent))"
              strokeWidth="2.2"
            />
          </motion.g>
          {/* Polovina B — ogledalo (rotira suprotno) */}
          <motion.g animate={{ rotate: angle }} transition={bladeSpring} style={pivotOrigin}>
            <path d="M22 24 L20 6.5 Q22 3 24 6.5 Z" fill="hsl(var(--accent))" opacity="0.85" />
            <circle
              cx="22"
              cy="32.5"
              r="4.4"
              fill="none"
              stroke="hsl(var(--accent))"
              strokeWidth="2.2"
              opacity="0.85"
            />
          </motion.g>
          {/* Šraf u sredini */}
          <circle cx="22" cy="24" r="2" fill="hsl(var(--background))" stroke="hsl(var(--accent))" strokeWidth="1.6" />
        </motion.svg>
      </motion.div>

      {/* SNIP prasak — zlatni prsten + iskrice na mestu klika */}
      {snip && (
        <div
          key={snip.id}
          className="absolute left-0 top-0"
          style={{ transform: `translate(${snip.x}px, ${snip.y}px)` }}
        >
          <motion.div
            initial={{ scale: 0.25, opacity: 0.9 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            onAnimationComplete={() => setSnip(null)}
            className="h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent"
          />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <motion.span
              key={a}
              initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              animate={{
                opacity: 0,
                x: Math.cos((a * Math.PI) / 180) * 26,
                y: Math.sin((a * Math.PI) / 180) * 26,
                scale: 0.3,
              }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute left-0 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
            />
          ))}
        </div>
      )}
    </div>
  );
}
