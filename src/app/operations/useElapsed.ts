import { useEffect, useState } from "react";

const TICK_MS = 1000;

/** Milliseconds since `startedAt`: ticks every second while `endedAt` is null, then stays at the final duration. */
export function useElapsed(startedAt: number, endedAt: number | null): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (endedAt !== null) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [endedAt]);
  return (endedAt ?? now) - startedAt;
}
