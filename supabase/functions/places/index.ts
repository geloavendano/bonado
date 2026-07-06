// Google Places (New) proxy. The client can't call Google directly from the
// native app: the API key is HTTP-referrer restricted and Google's
// allowlists don't accept capacitor:// schemes. Proxying also keeps the key
// out of the client bundle. Requires a valid Supabase JWT (verify_jwt).

const API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
// Any referer on the key's allowlist works; the dev origin is on it.
const REFERER = Deno.env.get("GOOGLE_PLACES_REFERER") ?? "http://localhost:5173/";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (!API_KEY) {
    return new Response(JSON.stringify({ error: "places proxy not configured" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const body = await request.json().catch(() => ({}));
  const headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": API_KEY,
    Referer: REFERER,
  };

  let upstream: Response;
  if (body.action === "autocomplete" && typeof body.input === "string") {
    upstream = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: body.input,
        sessionToken: body.sessionToken,
        includedPrimaryTypes: body.includedPrimaryTypes,
      }),
    });
  } else if (body.action === "details" && typeof body.placeId === "string") {
    const url = new URL(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(body.placeId)}`,
    );
    if (body.sessionToken) url.searchParams.set("sessionToken", body.sessionToken);
    upstream = await fetch(url, {
      headers: {
        ...headers,
        "X-Goog-FieldMask": "id,displayName,location,addressComponents",
      },
    });
  } else {
    return new Response(JSON.stringify({ error: "bad request" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
