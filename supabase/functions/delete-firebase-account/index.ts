import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.3";
const project = "dailyflow-6bd65";
const keys = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply(405, "Method not allowed");
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return reply(401, "Sign in required");
  let uid: string;
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: `https://securetoken.google.com/${project}`,
      audience: project,
      algorithms: ["RS256"],
    });
    const now = Math.floor(Date.now() / 1000);
    if (
      !payload.sub ||
      payload.sub.length > 128 ||
      payload.email_verified !== true ||
      typeof payload.auth_time !== "number" ||
      payload.auth_time > now + 30 ||
      now - payload.auth_time > 300
    )
      return reply(403, "Confirm your password again");
    uid = payload.sub;
    // Consult Firebase as well as checking the JWT to reject deleted/disabled users.
    const apiKey = Deno.env.get("FIREBASE_WEB_API_KEY");
    if (!apiKey) return reply(503, "Account cleanup is not configured");
    const lookup = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const account = await lookup.json();
    if (
      !lookup.ok ||
      account.users?.[0]?.localId !== uid ||
      account.users[0].disabled ||
      !account.users[0].emailVerified
    )
      return reply(401, "Sign in required");
  } catch {
    return reply(401, "Invalid or expired session");
  }
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  try {
    const { data: owner, error: lockError } = await admin.rpc(
      "begin_firebase_account_deletion",
      { firebase_subject: uid },
    );
    if (lockError) throw lockError;
    // No profile is possible if verification succeeded before first workspace open.
    if (!owner) return reply(200, "No cloud workspace to clean up");
    for (let batch = 0; batch < 100; batch++) {
      const { data: files, error } = await admin.storage
        .from("dailyflow-files")
        .list(owner, { limit: 100 });
      if (error) throw error;
      if (!files?.length) break;
      if (files.some((file) => !file.id))
        return reply(409, "Administrator cleanup required for nested folder");
      const { error: removeError } = await admin.storage
        .from("dailyflow-files")
        .remove(files.map((file) => `${owner}/${file.name}`));
      if (removeError) throw removeError;
      if (batch === 99) return reply(409, "Please retry to finish cleanup");
    }
    const { error } = await admin
      .from("flow_items")
      .delete()
      .eq("user_id", owner);
    if (error) throw error;
    const { error: profileError } = await admin
      .from("profiles")
      .update({ display_name: "" })
      .eq("id", owner);
    if (profileError) throw profileError;
    // Retain only the UID/owner tombstone to reject still-valid, pre-deletion JWTs.
    // The client now deletes its Firebase identity; retries remain idempotent.
    return reply(200, "Cloud data deleted");
  } catch {
    return reply(503, "Cleanup could not finish. Please retry.");
  }
});
