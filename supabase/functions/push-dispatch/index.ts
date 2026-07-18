// Sends a native push for a newly inserted bonado notification.
//
// Invoked by the notifications_push_dispatch trigger (0033) with
// { notification_id }. For iOS we send directly to APNs using token-based
// auth. Android delivery is intentionally skipped for now because bonado is
// currently iOS-only; add FCM later when Android becomes a release target.

import { createClient } from "npm:@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

interface ApnsConfig {
  keyId: string;
  teamId: string;
  bundleId: string;
  privateKey: string;
  environment: "production" | "sandbox";
}

interface NotificationRecord {
  id: string;
  kind: string;
  user_id: string;
  trip_id: string;
  entry_id: string | null;
  settlement_id: string | null;
  actor: { name: string } | null;
  entry: { description: string } | null;
  trip: { name: string } | null;
}

let cachedApnsToken: { value: string; expiresAt: number } | null = null;

function env(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.trim().length > 0 ? value : null;
}

function apnsConfig(): ApnsConfig | null {
  const keyId = env("APNS_KEY_ID");
  const teamId = env("APNS_TEAM_ID");
  const bundleId = env("APNS_BUNDLE_ID");
  const privateKey = env("APNS_PRIVATE_KEY");
  const environment =
    env("APNS_ENVIRONMENT") === "sandbox" ? "sandbox" : "production";
  if (!keyId || !teamId || !bundleId || !privateKey) return null;
  return { keyId, teamId, bundleId, privateKey, environment };
}

async function importApnsPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replaceAll("\\n", "")
    .replaceAll("\n", "")
    .trim();
  const raw = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

async function apnsProviderToken(config: ApnsConfig): Promise<string> {
  if (cachedApnsToken && cachedApnsToken.expiresAt > Date.now() + 60_000) {
    return cachedApnsToken.value;
  }
  const key = await importApnsPrivateKey(config.privateKey);
  const token = await create(
    { alg: "ES256", kid: config.keyId },
    { iss: config.teamId, iat: getNumericDate(0) },
    key,
  );
  // Apple permits provider auth tokens for up to one hour.
  cachedApnsToken = { value: token, expiresAt: Date.now() + 50 * 60_000 };
  return token;
}

function describe(notification: NotificationRecord): {
  title: string;
  body: string;
} {
  const actor = notification.actor?.name ?? "Someone";
  const expense = notification.entry?.description ?? "an expense";
  const trip = notification.trip?.name ?? "your trip";
  const titles: Record<string, string> = {
    expense_created: `${actor} added an expense`,
    expense_edited: `${actor} updated an expense`,
    expense_deleted: `${actor} deleted an expense`,
    settlement_created: `${actor} recorded a settlement`,
    settlement_edited: `${actor} updated a settlement`,
    settlement_deleted: `${actor} deleted a settlement`,
    comment_added: `${actor} commented on "${expense}"`,
    comment_mention: `${actor} mentioned you in a comment`,
  };
  return { title: titles[notification.kind] ?? "New activity", body: trip };
}

function notificationLink(notification: NotificationRecord): string {
  if (notification.entry_id) {
    return `/trips/${notification.trip_id}/expenses/${notification.entry_id}`;
  }
  if (notification.settlement_id) {
    return `/trips/${notification.trip_id}/settlements/${notification.settlement_id}`;
  }
  return `/trips/${notification.trip_id}`;
}

const staleApnsReasons = new Set([
  "BadDeviceToken",
  "DeviceTokenNotForTopic",
  "Unregistered",
]);

async function sendApns(
  config: ApnsConfig,
  token: string,
  notification: NotificationRecord,
): Promise<"delivered" | "stale" | "failed"> {
  const providerToken = await apnsProviderToken(config);
  const { title, body } = describe(notification);
  const host =
    config.environment === "sandbox"
      ? "https://api.sandbox.push.apple.com"
      : "https://api.push.apple.com";
  const response = await fetch(`${host}/3/device/${token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${providerToken}`,
      "apns-topic": config.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: { title, body },
        sound: "default",
      },
      link: notificationLink(notification),
    }),
  });

  if (response.ok) return "delivered";

  const errorBody = await response.json().catch(() => ({}));
  console.warn("push-dispatch: APNs delivery failed", {
    status: response.status,
    reason: errorBody.reason,
    notification_id: notification.id,
  });
  if (response.status === 410 || staleApnsReasons.has(errorBody.reason)) {
    return "stale";
  }
  return "failed";
}

Deno.serve(async (request) => {
  const { notification_id } = await request.json().catch(() => ({}));
  if (!notification_id) {
    return new Response(JSON.stringify({ error: "notification_id required" }), {
      status: 400,
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { db: { schema: "bonado" } },
  );

  const { data: notification } = await admin
    .from("notifications")
    .select(`
      id, kind, user_id, trip_id, entry_id, settlement_id,
      actor:users!notifications_actor_id_fkey(name),
      entry:entries(description),
      trip:trips(name)
    `)
    .eq("id", notification_id)
    .maybeSingle()
    .returns<NotificationRecord>();
  if (!notification) {
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
    });
  }

  const { data: tokens } = await admin
    .from("device_tokens")
    .select("token, platform")
    .eq("user_id", notification.user_id)
    .returns<{ token: string; platform: "ios" | "android" }[]>();
  if (!tokens?.length) {
    return new Response(JSON.stringify({ delivered: 0 }), { status: 200 });
  }

  const config = apnsConfig();
  let delivered = 0;
  let skipped = 0;
  let failed = 0;

  for (const { token, platform } of tokens) {
    if (platform !== "ios") {
      skipped += 1;
      continue;
    }
    if (!config) {
      skipped += 1;
      continue;
    }
    const result = await sendApns(config, token, notification);
    if (result === "delivered") {
      delivered += 1;
    } else if (result === "stale") {
      await admin.from("device_tokens").delete().eq("token", token);
    } else {
      failed += 1;
    }
  }

  if (!config) {
    console.log("push-dispatch: APNs secrets not set; skipping iOS delivery");
  }
  return new Response(JSON.stringify({ delivered, skipped, failed }), {
    status: 200,
  });
});
