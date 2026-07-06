import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { Browser } from "@capacitor/browser";
import { SplashScreen } from "@capacitor/splash-screen";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { registerForPush, pushTapLink } from "@/lib/pushRegistration";

let nativeLaunchHandled = false;

function versionBelow(current: string, minimum: string): boolean {
  const parse = (value: string) =>
    value.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const [cMajor = 0, cMinor = 0, cPatch = 0] = parse(current);
  const [mMajor = 0, mMinor = 0, mPatch = 0] = parse(minimum);
  if (cMajor !== mMajor) return cMajor < mMajor;
  if (cMinor !== mMinor) return cMinor < mMinor;
  return cPatch < mPatch;
}

/**
 * Native-only glue rendered inside the router: Android back button,
 * auth token refresh on resume, deep links (invites, transactions, and the
 * OAuth PKCE callback), and the minimum-supported-version gate. Renders
 * nothing on the web.
 */
export function NativeShell() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [updateRequired, setUpdateRequired] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || authLoading || nativeLaunchHandled) return;
    nativeLaunchHandled = true;

    void (async () => {
      try {
        if (user && window.location.pathname === "/") {
          const { data } = await supabase
            .from("trips")
            .select("id")
            .order("last_activity_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data?.id) {
            navigate(`/trips/${data.id}`, {
              state: { transition: "forward" },
            });
          }
        }
      } finally {
        await SplashScreen.hide().catch(() => undefined);
      }
    })();
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;
    void registerForPush(user.id);
    const tapListener = PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (event) => {
        const link = pushTapLink(event.notification.data);
        if (link) navigate(link);
      },
    );
    return () => void tapListener.then((l) => l.remove());
  }, [user, navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listeners = [
      CapApp.addListener("backButton", ({ canGoBack }) => {
        const pathname = window.location.pathname;
        const tabMatch = pathname.match(/^\/trips\/([^/]+)\/(?:balances|reports)$/);
        const tripMatch = pathname.match(/^\/trips\/([^/]+)$/);
        if (tabMatch) {
          navigate("/", { replace: true });
        } else if (tripMatch) {
          navigate("/", { replace: true });
        } else if (pathname === "/" || !canGoBack) {
          void CapApp.exitApp();
        } else {
          window.history.back();
        }
      }),
      CapApp.addListener("appStateChange", ({ isActive }) => {
        // Backgrounded WebViews suspend timers, so the supabase-js token
        // refresh loop must be restarted explicitly on resume.
        if (isActive) {
          void supabase.auth.startAutoRefresh();
        } else {
          void supabase.auth.stopAutoRefresh();
        }
      }),
      CapApp.addListener("appUrlOpen", ({ url }) => {
        void (async () => {
          try {
            const opened = new URL(url);
            const code = opened.searchParams.get("code");
            if (code) {
              // returning from the system-browser OAuth hop
              await Browser.close().catch(() => undefined);
              await supabase.auth.exchangeCodeForSession(code);
              navigate("/", { replace: true });
              return;
            }
            navigate(opened.pathname + opened.search);
          } catch {
            // Unparseable or foreign URL — ignore rather than crash the shell.
          }
        })();
      }),
    ];

    void (async () => {
      try {
        const [{ version }, { data }] = await Promise.all([
          CapApp.getInfo(),
          supabase
            .from("app_config")
            .select("value")
            .eq("key", "min_supported_native_version")
            .maybeSingle(),
        ]);
        if (data?.value && versionBelow(version, data.value)) {
          setUpdateRequired(true);
        }
      } catch {
        // Never block launch because the version check itself failed.
      }
    })();

    return () => {
      for (const listener of listeners) void listener.then((l) => l.remove());
    };
  }, [navigate]);

  if (!updateRequired) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bg px-8">
      <div className="max-w-[300px] text-center">
        <div className="text-2xl font-extrabold tracking-[-0.5px]">
          bonado<span className="text-teal">.</span>
        </div>
        <div className="mt-4 text-[16px] font-bold">Update required</div>
        <p className="mt-2 text-[13.5px] text-secondary">
          This version of the app is no longer supported. Please update to the
          latest version from the app store to keep your trips in sync.
        </p>
      </div>
    </div>
  );
}
