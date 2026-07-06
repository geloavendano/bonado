import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { refreshVisibleData } from "@/lib/dataRefresh";

export function PullToRefresh() {
  const startY = useRef<number | null>(null);
  const distanceRef = useRef(0);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    function start(event: TouchEvent) {
      if (
        window.scrollY <= 0 &&
        !((event.target as Element | null)?.closest(
          "input,textarea,select,[role='dialog']",
        ))
      ) {
        startY.current = event.touches[0]?.clientY ?? null;
      }
    }
    function move(event: TouchEvent) {
      if (startY.current === null || window.scrollY > 0) return;
      const delta = Math.max(0, (event.touches[0]?.clientY ?? 0) - startY.current);
      distanceRef.current = Math.min(96, delta * 0.45);
      setDistance(distanceRef.current);
    }
    async function end() {
      const shouldRefresh = distanceRef.current >= 64;
      startY.current = null;
      distanceRef.current = 0;
      setDistance(0);
      if (shouldRefresh) {
        setRefreshing(true);
        await refreshVisibleData();
        setRefreshing(false);
      }
    }
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", end);
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
    };
  }, []);

  if (!Capacitor.isNativePlatform() || (distance === 0 && !refreshing)) return null;
  return (
    <>
      {refreshing && (
        <div
          className="pointer-events-none fixed inset-x-6 z-[140] mx-auto max-w-[382px]"
          style={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
          aria-label="Refreshing"
        >
          <div className="skeleton h-1.5 w-full rounded-pill" />
        </div>
      )}
      <div
        className="pointer-events-none fixed inset-x-0 z-[140] flex justify-center"
        style={{ top: `calc(env(safe-area-inset-top) + ${distance - 28}px)` }}
      >
        {distance > 0 && (
          <div className="grid size-8 place-items-center rounded-full bg-card text-[14px] text-teal shadow-[var(--shadow-floating)]">
            {distance >= 64 ? "↓" : "↻"}
          </div>
        )}
      </div>
    </>
  );
}
