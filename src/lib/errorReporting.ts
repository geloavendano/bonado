/**
 * Crash reporting, dormant until VITE_SENTRY_DSN is set (Vercel env for the
 * web, native env at build time for the apps). The SDK is dynamically
 * imported so an unset DSN costs zero bundle bytes — important because the
 * store builds are where crash visibility matters most and the web bundle
 * shouldn't pay for it meanwhile.
 */
export function initErrorReporting(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  void import("@sentry/react")
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        // Keep it lean: errors only, no performance tracing volume.
        tracesSampleRate: 0,
        sendDefaultPii: false,
      });
    })
    .catch(() => {
      // Reporting must never break the app it reports on.
    });
}
