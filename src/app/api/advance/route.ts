import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // IMPORTANT: service role, not anon
);

export async function POST(req: Request) {
  try {
    const { topicId, secret } = await req.json();

    if (!topicId) {
      return NextResponse.json({ ok: false, error: "Missing topicId" }, { status: 400 });
    }

    // simple auth so random people can't advance
    if (!process.env.ADVANCE_SECRET || secret !== process.env.ADVANCE_SECRET) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin.rpc("advance_topic", {
      p_topic_id: topicId,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
