import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Countdown helper that follows the SERVER clock (BR-025): every response carries
 * `serverTime`; the offset to the device clock is kept so a wrong phone clock never
 * shows a wrong deadline. Returns a `now()` in server time that re-renders every second.
 */
export function useServerClock(): { now: () => number; sync: (serverTimeIso: string) => void } {
  const offset = useRef(0);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const sync = useCallback((serverTimeIso: string) => {
    offset.current = Date.parse(serverTimeIso) - Date.now();
  }, []);
  const now = useCallback(() => Date.now() + offset.current, []);
  return useMemo(() => ({ now, sync }), [now, sync]);
}

export function formatCountdown(milliseconds: number): string {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Polls `load` every `intervalMs` while mounted (SSE comes later, CLAUDE.md ADR-016). */
export function usePolling(load: () => void, intervalMs: number): void {
  useEffect(() => {
    load();
    const id = setInterval(load, intervalMs);
    return () => clearInterval(id);
  }, [load, intervalMs]);
}
