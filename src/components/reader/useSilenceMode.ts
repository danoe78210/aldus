import { useEffect, useState } from "react";

export const SILENCE_DELAY_MS = 3000;

/** `true` après `delay` ms sans mouvement de souris ; tout mouvement rétablit l'interface instantanément. */
export const useSilenceMode = (delay = SILENCE_DELAY_MS): boolean => {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), delay);
    };
    const wake = () => {
      setIdle(false);
      arm();
    };
    const events = ["mousemove", "pointerdown", "keydown", "touchstart"] as const;
    arm();
    events.forEach((name) => window.addEventListener(name, wake));
    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, wake));
    };
  }, [delay]);
  return idle;
};

export const chromeClass = (idle: boolean): string =>
  idle ? "opacity-0 transition-opacity duration-700" : "opacity-100 transition-opacity duration-0";
