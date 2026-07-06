import { Capacitor } from "@capacitor/core";

const configuredUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)
  ?.trim()
  .replace(/\/+$/, "");

export function publicAppUrl() {
  if (configuredUrl) return configuredUrl;
  if (!Capacitor.isNativePlatform()) return window.location.origin;
  return "https://bonado-sage.vercel.app";
}

export function inviteUrl(token: string) {
  return `${publicAppUrl()}/join/${token}`;
}
