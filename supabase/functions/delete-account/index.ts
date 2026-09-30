import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const response = (status: number, message: string) =>
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
  if (req.method !== "POST") return response(405, "Method not allowed");
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    return response(401, "Sign in required");
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.slice(7);
  try {
    // getUser consults Auth, and getClaims verifies the signed authentication
    // methods. A refreshed token alone does not count as a recent password check.
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);
    if (error || !user) return response(401, "Sign in required");
    const { data: verified, error: claimError } =
      await admin.auth.getClaims(token);
    if (claimError || verified?.claims.sub !== user.id)
      return response(401, "Invalid session");
    const methods = verified.claims.amr as
      { method: string; timestamp: number }[] | undefined;
    const now = Math.floor(Date.now() / 1000);
    if (
      !methods?.some(
        (m) =>
          m.method === "password" &&
          m.timestamp <= now + 30 &&
          now - m.timestamp < 300,
      )
    )
      return response(
        403,
        "Confirm your password again before deleting your account",
      );
    const { error: lockError } = await admin
      .from("profiles")
      .update({ deletion_pending: true })
      .eq("id", user.id);
    if (lockError) throw lockError;
    // Block new uploads first. Retrying this operation safely resumes cleanup
    // after a partial storage failure; the user is deleted only after cleanup.
    for (let batch = 0; batch < 100; batch++) {
      const { data: files, error: listError } = await admin.storage
        .from("dailyflow-files")
        .list(user.id, { limit: 100 });
      if (listError) throw listError;
      if (!files?.length) break;
      if (files.some((file) => !file.id))
        return response(409, "A nested folder requires administrator cleanup");
      const { error: removeError } = await admin.storage
        .from("dailyflow-files")
        .remove(files.map((file) => `${user.id}/${file.name}`));
      if (removeError) throw removeError;
      if (batch === 99)
        return response(409, "Cleanup is in progress. Please retry deletion.");
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    return response(200, "Account and cloud data deleted");
  } catch {
    return response(
      503,
      "Deletion could not finish. Please retry to resume cleanup.",
    );
  }
});
