// Sends an FCM push for a newly inserted bonado notification.
//
// Invoked by the notifications_push_dispatch trigger (0033) with
// { notification_id }. Looks up the notification + recipient device tokens
// with the service role, builds a short human message, and delivers via
// FCM HTTP v1. Requires the FIREBASE_SERVICE_ACCOUNT secret (the JSON of a
// Firebase service account with the FCM API enabled); without it the
// function logs and exits 200 so the trigger stays harmless.

import { createClient } from "npm:@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

interface ServiceAccount {
  project_id: string;
  private_key: string;
  client_email: string;
}

let cachedToken: { value: string; expires: number } | null = null;

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replaceAll("\\n", "")
    .replaceAll("\n", "");
  const raw = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function fcmAccessToken(account: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const key = await importPrivateKey(account.private_key);
  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: getNumericDate(0),
      exp: getNumericDate(3600),
    },
    key,
  );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await response.json();
  if (!json.access_token) throw new Error("FCM token exchange failed");
  cachedToken = { value: json.access_token, expires: Date.now() + 55 * 60_000 };
  return json.access_token;
}

function describe(notification: {
  kind: string;
  actor: { name: string } | null;
  entry: { description: string } | null;
  trip: { name: string } | null;
}): { title: string; body: string } {
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

Deno.serve(async (request) => {
  const { notification_id } = await request.json().catch(() => ({}));
  if (!notification_id) {
    return new Response(JSON.stringify({ error: "notification_id required" }), { status: 400 });
  }

  const accountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!accountJson) {
    console.log("push-dispatch: FIREBASE_SERVICE_ACCOUNT not set; skipping");
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }
  const account = JSON.parse(accountJson) as ServiceAccount;

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
    .maybeSingle();
  if (!notification) {
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  }

  const { data: tokens } = await admin
    .from("device_tokens")
    .select("token")
    .eq("user_id", notification.user_id);
  if (!tokens?.length) {
    return new Response(JSON.stringify({ delivered: 0 }), { status: 200 });
  }

  const { title, body } = describe(notification);
  const link = notification.entry_id
    ? `/trips/${notification.trip_id}/expenses/${notification.entry_id}`
    : `/trips/${notification.trip_id}/settlements/${notification.settlement_id}`;

  const accessToken = await fcmAccessToken(account);
  let delivered = 0;
  for (const { token } of tokens) {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data: { link },
          },
        }),
      },
    );
    if (response.ok) {
      delivered += 1;
    } else if (response.status === 404 || response.status === 400) {
      // stale registration — drop it
      await admin.from("device_tokens").delete().eq("token", token);
    }
  }
  return new Response(JSON.stringify({ delivered }), { status: 200 });
});
