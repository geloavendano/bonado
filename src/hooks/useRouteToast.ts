import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface ToastRouteState {
  toast?: string;
  [key: string]: unknown;
}

export function useRouteToast(duration = 2800) {
  const location = useLocation();
  const navigate = useNavigate();
  const incoming = (location.state as ToastRouteState | null)?.toast ?? null;
  const [message, setMessage] = useState<string | null>(incoming);

  useEffect(() => {
    if (!incoming) return;
    setMessage(incoming);
    const nextState = { ...((location.state as ToastRouteState | null) ?? {}) };
    delete nextState.toast;
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: nextState,
    });
  }, [
    incoming,
    location.hash,
    location.pathname,
    location.search,
    location.state,
    navigate,
  ]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), duration);
    return () => window.clearTimeout(timer);
  }, [duration, message]);

  return message;
}
