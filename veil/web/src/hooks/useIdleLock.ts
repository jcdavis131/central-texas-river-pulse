import { useEffect, useRef } from "react";

/**
 * Locks the vault after `minutes` of no user activity. Pass 0 (or a falsy
 * value) to disable. Any pointer/keyboard/visibility activity resets the timer.
 */
export function useIdleLock(minutes: number, enabled: boolean, onLock: () => void) {
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  useEffect(() => {
    if (!enabled || !minutes || minutes <= 0) return;
    const ms = minutes * 60_000;
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onLockRef.current(), ms);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    const onVisible = () => {
      if (document.visibilityState === "visible") reset();
    };
    document.addEventListener("visibilitychange", onVisible);

    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [minutes, enabled]);
}
