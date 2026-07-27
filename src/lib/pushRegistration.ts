import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type PermissionStatus,
} from "@capacitor/push-notifications";
import { supabase } from "@/lib/supabase";

let listenersAttached = false;
let currentPushUserId: string | null = null;
let latestPushToken: string | null = null;

export type PushPermissionState = PermissionStatus["receive"] | "unsupported";

export function supportsNativePush(): boolean {
  return Capacitor.isNativePlatform();
}

export async function checkPushPermission(): Promise<PushPermissionState> {
  if (!supportsNativePush()) return "unsupported";
  return (await PushNotifications.checkPermissions()).receive;
}

async function savePushToken(token: string, userId = currentPushUserId) {
  latestPushToken = token;
  if (!userId) {
    console.warn("Push registration returned a token before a user was available");
    return;
  }

  const { error } = await supabase.from("device_tokens").upsert(
    {
      token,
      user_id: userId,
      platform: Capacitor.getPlatform() === "ios" ? "ios" : "android",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );

  if (error) {
    console.warn("Could not save push token", error);
    throw error;
  }

  window.dispatchEvent(new Event("bonado:push-token-saved"));
}

async function attachPushListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  await PushNotifications.addListener("registration", ({ value }) => {
    void savePushToken(value).catch(() => undefined);
  });
  await PushNotifications.addListener("registrationError", (error) => {
    console.warn("Push registration failed", error);
  });
}

/**
 * Registers this native device for push and upserts its platform token for the
 * signed-in bonado user. Safe to call repeatedly; no-op on the web or when the
 * user declines the permission prompt. Pass requestPermission=false to silently
 * register only when push is already enabled.
 */
export async function registerForPush(
  userId: string,
  options: { requestPermission?: boolean } = {},
): Promise<PushPermissionState> {
  if (!supportsNativePush()) return "unsupported";

  currentPushUserId = userId;
  const requestPermission = options.requestPermission ?? true;

  const permission = await PushNotifications.checkPermissions();
  let receive = permission.receive;
  if (
    requestPermission &&
    (receive === "prompt" || receive === "prompt-with-rationale")
  ) {
    receive = (await PushNotifications.requestPermissions()).receive;
  }
  if (receive !== "granted") return receive;

  await attachPushListeners();
  if (latestPushToken) {
    await savePushToken(latestPushToken, userId).catch(() => undefined);
  }
  await PushNotifications.register();
  window.dispatchEvent(new Event("bonado:push-permission-changed"));
  return receive;
}

export async function enablePushNotifications(
  userId: string,
): Promise<PushPermissionState> {
  const receive = await registerForPush(userId, { requestPermission: true });
  window.dispatchEvent(new Event("bonado:push-permission-changed"));
  return receive;
}

export async function hasSavedPushToken(userId: string): Promise<boolean> {
  if (!supportsNativePush()) return false;
  const { count, error } = await supabase
    .from("device_tokens")
    .select("token", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) {
    console.warn("Could not check saved push token", error);
    return false;
  }
  return (count ?? 0) > 0;
}

export function openNativeNotificationSettings() {
  if (!supportsNativePush()) return;
  if (Capacitor.getPlatform() === "ios") {
    window.location.href = "app-settings:";
  }
}

/** Routes a tapped push to its transaction; returns the link or null. */
export function pushTapLink(data: unknown): string | null {
  if (data && typeof data === "object" && "link" in data) {
    const link = (data as { link?: unknown }).link;
    if (typeof link === "string" && link.startsWith("/")) return link;
  }
  return null;
}
