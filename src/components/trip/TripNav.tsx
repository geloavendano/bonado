import { Link, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { runTripPaneTransition } from "@/lib/tripPaneTransition";

const TABS = [
  { key: "entries", label: "Entries", icon: "▤", path: "" },
  { key: "balances", label: "Balances", icon: "⇄", path: "/balances" },
  { key: "reports", label: "Reports", icon: "◔", path: "/reports" },
] as const;

type TripTabKey = (typeof TABS)[number]["key"];

export function TripNav({ tripId }: { tripId: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);
  const [nativeBlockedByOverlay, setNativeBlockedByOverlay] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const nativeTripNavEnabled = Capacitor.getPlatform() === "ios";
  const base = `/trips/${tripId}`;
  const activeIndex = Math.max(
    0,
    TABS.findIndex((tab) => location.pathname === `${base}${tab.path}`),
  );
  const activeTab = TABS[activeIndex]?.key ?? "entries";

  function navigateToTab(tabKey: TripTabKey) {
    const tab = TABS.find((item) => item.key === tabKey);
    if (!tab) return;

    const href = `${base}${tab.path}`;
    const targetIndex = TABS.findIndex((item) => item.key === tab.key);

    if (location.pathname === href) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const direction = targetIndex > activeIndex ? "left" : "right";
    runTripPaneTransition(direction, (usingViewTransition) => {
      navigate(href, {
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
  }

  useEffect(() => {
    lastScrollY.current = window.scrollY;
    setHidden(false);

    function updateVisibility() {
      const currentY = Math.max(0, window.scrollY);
      const delta = currentY - lastScrollY.current;

      if (currentY < 96) {
        setHidden(false);
      } else if (delta > 10) {
        setHidden(true);
      } else if (delta < -10) {
        setHidden(false);
      }

      lastScrollY.current = currentY;
      ticking.current = false;
    }

    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(updateVisibility);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [location.pathname]);

  useEffect(() => {
    if (!nativeTripNavEnabled) return;

    window.webkit?.messageHandlers?.bonadoNativeNav?.postMessage({
      type: "tripNav:update",
      visible: true,
      tripId,
      activeTab,
      hidden: hidden || nativeBlockedByOverlay,
    });
  }, [activeTab, hidden, nativeBlockedByOverlay, nativeTripNavEnabled, tripId]);

  useEffect(() => {
    if (!nativeTripNavEnabled) return;
    return () => {
      window.webkit?.messageHandlers?.bonadoNativeNav?.postMessage({
        type: "tripNav:update",
        visible: false,
        tripId,
      });
    };
  }, [nativeTripNavEnabled, tripId]);

  useEffect(() => {
    if (!nativeTripNavEnabled) return;

    function updateOverlayBlock() {
      const hasBlockingOverlay = Boolean(
        document.querySelector('[aria-modal="true"], [data-native-nav-hidden="true"]'),
      );
      setNativeBlockedByOverlay(hasBlockingOverlay);
    }

    updateOverlayBlock();
    const observer = new MutationObserver(updateOverlayBlock);
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["aria-modal", "data-native-nav-hidden"],
    });

    return () => observer.disconnect();
  }, [nativeTripNavEnabled]);

  useEffect(() => {
    if (!nativeTripNavEnabled) return;

    function onNativeTripNav(event: Event) {
      const detail = (event as CustomEvent).detail as
        | { action?: string; tab?: TripTabKey }
        | undefined;

      if (detail?.action === "selectTab" && detail.tab) {
        navigateToTab(detail.tab);
      }

      if (detail?.action === "addExpense") {
        navigate(`${base}/expenses/new`, { state: { transition: "sheet" } });
      }
    }

    window.addEventListener("bonado:native-trip-nav", onNativeTripNav);
    return () => window.removeEventListener("bonado:native-trip-nav", onNativeTripNav);
  }, [activeIndex, base, location.pathname, nativeTripNavEnabled, navigate]);

  if (nativeTripNavEnabled) return null;

  return (
    <div
      className={clsx(
        "trip-bottom-nav fixed inset-x-0 bottom-0 z-10 pointer-events-none transform-gpu transition-transform duration-[420ms] ease-[cubic-bezier(0.2,0.9,0.18,1)] will-change-transform",
        hidden ? "translate-y-[calc(100%+28px)]" : "translate-y-0",
      )}
    >
      <div
        className="mx-auto flex w-full max-w-[430px] items-center gap-3 px-6"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
        >
        <nav
          className="liquid-nav relative grid min-w-0 flex-1 grid-cols-3 items-stretch rounded-[30px] p-2 pointer-events-auto"
          aria-label="Trip sections"
        >
          <span
            aria-hidden="true"
            className="liquid-nav-pill absolute inset-y-2 left-2 rounded-[22px] transition-transform duration-[380ms] ease-[cubic-bezier(0.2,0.9,0.18,1)]"
            style={{
              width: "calc((100% - 16px) / 3)",
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          />
          {TABS.map((tab) => {
            const href = `${base}${tab.path}`;
            const active = location.pathname === href;
            const classes = clsx(
              "liquid-nav-item relative z-[1] flex min-w-0 min-h-11 flex-col items-center justify-center gap-0.5 rounded-[22px] px-1.5 py-2.5 text-[10.5px] leading-none",
              active ? "text-ink font-extrabold" : "text-secondary font-semibold",
            );
            const content = (
              <>
                <span className="text-[19px] leading-none">{tab.icon}</span>
                {tab.label}
              </>
            );
            return active ? (
              <button
                key={tab.key}
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className={classes}
                aria-current="page"
              >
                {content}
              </button>
            ) : (
              <Link
                key={tab.key}
                to={href}
                replace
                onClick={(event) => {
                  event.preventDefault();
                  navigateToTab(tab.key);
                }}
                className={classes}
              >
                {content}
              </Link>
            );
          })}
        </nav>
        <Link
          to={`${base}/expenses/new`}
          state={{ transition: "sheet" }}
          className="liquid-fab grid size-12 flex-none place-items-center rounded-full text-white pointer-events-auto"
          aria-label="Add expense"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
