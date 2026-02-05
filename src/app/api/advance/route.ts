import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// This makes sure it runs in a normal Node environment (good for service role)
export const runtime = "nodejs";

function json(ok: boolean, data: Record<string, any>, status = 200) {
  return NextResponse.json({ ok, ...data }, { status });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  // 1) Block anyone who doesn't have the secret
  if (!process.env.ADVANCE_SECRET || secret !== process.env.ADVANCE_SECRET) {
    return json(false, { error: "Bad or missing secret" }, 401);
  }

  // 2) Ensure required env vars exist
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(false, { error: "Missing Supabase env vars" }, 500);
  }

  // 3) Create Supabase "admin" client (service role can write)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  // ✅ TEMP: return success so you can confirm it works
  // Later we put real "advance round" logic here
  return json(true, { message: "Advance route is live ✅" });
}

// Optional: allow POST too (cron can call GET or POST)
export async function POST(req: Request) {
  return GET(req);
}
