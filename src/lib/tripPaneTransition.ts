import { flushSync } from "react-dom";

type Direction = "left" | "right";

function runSnapshotTransition(direction: Direction, update: () => void) {
  const source = document.querySelector<HTMLElement>(".trip-pane");
  if (!source) {
    update();
    return;
  }

  const rect = source.getBoundingClientRect();
  const ghost = source.cloneNode(true) as HTMLElement;
  const sourceTopChrome = source.querySelector<HTMLElement>(".trip-top-nav");
  const topChromeRect = sourceTopChrome?.getBoundingClientRect();
  const topChromeGhost = sourceTopChrome?.cloneNode(true) as HTMLElement | undefined;
  ghost.querySelector(".trip-top-nav")?.remove();
  ghost.classList.remove("trip-pane");
  ghost.classList.add("trip-pane-ghost", `trip-pane-ghost-${direction}`);
  ghost.setAttribute("aria-hidden", "true");
  ghost.inert = true;
  Object.assign(ghost.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${Math.max(rect.height, window.innerHeight - rect.top)}px`,
  });

  document.body.appendChild(ghost);
  if (topChromeGhost && topChromeRect) {
    topChromeGhost.classList.remove("trip-top-nav");
    topChromeGhost.classList.add("trip-top-nav-ghost");
    topChromeGhost.setAttribute("aria-hidden", "true");
    topChromeGhost.inert = true;
    Object.assign(topChromeGhost.style, {
      left: `${topChromeRect.left}px`,
      top: `${topChromeRect.top}px`,
      width: `${topChromeRect.width}px`,
      height: `${topChromeRect.height}px`,
    });
    document.body.appendChild(topChromeGhost);
  }
  flushSync(update);
  const incomingTopChrome = document.querySelector<HTMLElement>(
    ".trip-pane .trip-top-nav",
  );
  incomingTopChrome?.classList.add("trip-top-nav-entering");
  window.setTimeout(() => {
    ghost.remove();
    topChromeGhost?.remove();
    incomingTopChrome?.classList.remove("trip-top-nav-entering");
  }, 380);
}

export function runTripPaneTransition(
  direction: Direction,
  update: (usingViewTransition: boolean) => void,
) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const startViewTransition = document.startViewTransition?.bind(document);

  if (!startViewTransition || reducedMotion) {
    if (reducedMotion) update(false);
    else runSnapshotTransition(direction, () => update(false));
    return;
  }

  document.documentElement.dataset.tripPaneDirection = direction;
  const transition = startViewTransition(() => {
    flushSync(() => update(true));
  });
  void transition.finished.finally(() => {
    delete document.documentElement.dataset.tripPaneDirection;
  });
}
