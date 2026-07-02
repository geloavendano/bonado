import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

const PREFIX = "bonado:scroll:";

export function NavigationRestoration() {
  const location = useLocation();

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    const key = `${PREFIX}${location.key}`;
    const savedPosition = Number(sessionStorage.getItem(key) ?? 0);
    let frame = 0;
    let attempts = 0;

    function restore() {
      window.scrollTo({ top: savedPosition, behavior: "instant" });
      attempts += 1;
      if (Math.abs(window.scrollY - savedPosition) > 1 && attempts < 120) {
        frame = requestAnimationFrame(restore);
      }
    }
    frame = requestAnimationFrame(restore);

    return () => {
      cancelAnimationFrame(frame);
      sessionStorage.setItem(key, String(window.scrollY));
    };
  }, [location.key]);

  return null;
}
