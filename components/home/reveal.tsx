"use client";

import { useEffect, useRef, type ReactNode } from "react";

type RevealProps = {
  className?: string;
  children: ReactNode;
};

// Sección que aparece al entrar en pantalla (añade la clase `in`). Sin
// IntersectionObserver o con "reducir movimiento" se muestra de inmediato
// para no quedar invisible. `className` es estático, así que React no pisa `in`.
export function Reveal({ className = "", children }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      el.classList.add("in");
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.disconnect();
          }
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className={`reveal ${className}`.trim()}>
      {children}
    </section>
  );
}
