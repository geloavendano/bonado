import { useRef, useState, type TouchEventHandler } from "react";

export function useSwipeDownDismiss(onDismiss: () => void) {
  const startY = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);

  const onTouchStart: TouchEventHandler<HTMLDivElement> = (event) => {
    if (window.scrollY <= 0 && event.touches[0].clientY < 140) {
      startY.current = event.touches[0].clientY;
    }
  };
  const onTouchMove: TouchEventHandler<HTMLDivElement> = (event) => {
    if (startY.current === null) return;
    setOffset(Math.max(0, event.touches[0].clientY - startY.current));
  };
  const onTouchEnd = () => {
    if (offset > 110) onDismiss();
    startY.current = null;
    setOffset(0);
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    style: {
      transform: `translateY(${offset}px)`,
      transition: offset > 0 ? "none" : "transform 180ms ease-out",
    },
  };
}

