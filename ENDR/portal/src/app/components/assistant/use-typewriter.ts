"use client";

import { useEffect, useState } from "react";

// Reveals `text` character-by-character for a light "robot is talking" effect.
// Responses are scripted and arrive whole, so this is purely cosmetic — no
// streaming. Honours prefers-reduced-motion by showing the full text instantly.
export function useTypewriter(text: string, speed = 16): { out: string; done: boolean } {
  const [out, setOut] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (!text || reduce) {
      setOut(text);
      setDone(true);
      return;
    }

    setOut("");
    setDone(false);

    let raf = 0;
    let last = 0;
    let i = 0;

    const tick = (t: number) => {
      if (!last) last = t;
      if (t - last >= speed) {
        i += Math.max(1, Math.round((t - last) / speed));
        last = t;
        if (i >= text.length) {
          setOut(text);
          setDone(true);
          return;
        }
        setOut(text.slice(0, i));
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, speed]);

  return { out, done };
}
