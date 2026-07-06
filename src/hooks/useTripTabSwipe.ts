import { useRef, type TouchEventHandler } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { runTripPaneTransition } from "@/lib/tripPaneTransition";

const TAB_PATHS = ["", "/balances", "/reports"] as const;
const SWIPE_THRESHOLD = 64;
const EDGE_BACK_ZONE = 28;

export function useTripTabSwipe(tripId: string, enabled: boolean) {
  const navigate = useNavigate();
  const location = useLocation();
  const start = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart: TouchEventHandler<HTMLDivElement> = (event) => {
    if (!enabled || event.touches.length !== 1) return;
    const target = event.target as Element | null;
    if (
      target?.closest(
        "input,textarea,select,[role='dialog'],[data-disable-tab-swipe]",
      )
    ) {
      return;
    }
    const touch = event.touches[0];
    if (touch.clientX <= EDGE_BACK_ZONE) return;
    start.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd: TouchEventHandler<HTMLDivElement> = (event) => {
    const origin = start.current;
    start.current = null;
    if (!origin || event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - origin.x;
    const deltaY = touch.clientY - origin.y;
    if (
      Math.abs(deltaX) < SWIPE_THRESHOLD ||
      Math.abs(deltaX) < Math.abs(deltaY) * 1.2
    ) {
      return;
    }

    const base = `/trips/${tripId}`;
    const currentIndex = Math.max(
      0,
      TAB_PATHS.findIndex((path) => location.pathname === `${base}${path}`),
    );
    const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    const nextPath = TAB_PATHS[nextIndex];
    if (nextPath === undefined) return;

    const direction = deltaX < 0 ? "left" : "right";
    runTripPaneTransition(direction, (usingViewTransition) => {
      navigate(`${base}${nextPath}`, {
        replace: true,
        state: {
          transition: usingViewTransition
            ? "tab-view"
            : direction === "left"
              ? "tab-left"
              : "tab-right",
        },
      });
    });
  };

  return { onTouchStart, onTouchEnd };
}
