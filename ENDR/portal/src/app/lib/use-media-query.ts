"use client";

import { useEffect, useState } from "react";

// SSR-safe media query hook: returns false on the server + first paint, then the
// real match after mount. (Used to swap overflowing tables for compact cards on
// mobile — cards are the SSR default, so there's no table flash.)
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return matches;
}
