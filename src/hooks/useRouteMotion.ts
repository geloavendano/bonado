import { useLocation } from "react-router-dom";

export function useRouteMotion(fallback?: "forward" | "sheet") {
  const location = useLocation();
  const transition =
    (location.state as { transition?: string } | null)?.transition ?? fallback;
  if (transition === "forward") return "motion-page-forward";
  if (transition === "tab-left") return "motion-tab-left";
  if (transition === "tab-right") return "motion-tab-right";
  if (transition === "sheet") return "motion-sheet-up";
  return undefined;
}
