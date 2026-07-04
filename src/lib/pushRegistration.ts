import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/lib/supabase";

let listenersAttached = false;

/**
 * Registers this native device for push and upserts its FCM token for the
 * signed-in bonado user. Safe to call repeatedly; no-op on the web or when
 * the user declines the permission prompt.
 */
export async function registerForPush(userId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const permission = await PushNotifications.checkPermissions();
  let receive = permission.receive;
  if (receive === "prompt" || receive === "prompt-with-rationale") {
    receive = (await PushNotifications.requestPermissions()).receive;
  }
  if (receive !== "granted") return;

  if (!listenersAttached) {
    listenersAttached = true;
    await PushNotifications.addListener("registration", ({ value }) => {
      void supabase.from("device_tokens").upsert(
        {
          token: value,
          user_id: userId,
          platform: Capacitor.getPlatform() === "ios" ? "ios" : "android",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token" },
      );
    });
  }

  await PushNotifications.register();
}

/** Routes a tapped push to its transaction; returns the link or null. */
export function pushTapLink(data: unknown): string | null {
  if (data && typeof data === "object" && "link" in data) {
    const link = (data as { link?: unknown }).link;
    if (typeof link === "string" && link.startsWith("/")) return link;
  }
  return null;
}
