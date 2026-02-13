import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { matchupId, choiceEntryId, voterId } = await req.json();

    if (!matchupId || !choiceEntryId || !voterId) {
      return NextResponse.json(
        { ok: false, error: "Missing fields" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1) Validate matchup + entry
    const { data: matchup, error: mErr } = await supabase
      .from("matchups")
      .select("a_entry_id, b_entry_id")
      .eq("id", matchupId)
      .single();

    if (mErr || !matchup) {
      return NextResponse.json(
        { ok: false, error: "Matchup not found" },
        { status: 404 }
      );
    }

    if (
      choiceEntryId !== matchup.a_entry_id &&
      choiceEntryId !== matchup.b_entry_id
    ) {
      return NextResponse.json(
        { ok: false, error: "Invalid choice for matchup" },
        { status: 400 }
      );
    }

    // 2) Prevent double voting
    const { data: existing } = await supabase
      .from("votes")
      .select("id")
      .eq("matchup_id", matchupId)
      .eq("voter_id", voterId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: false }, { status: 409 });
    }

    // 3) Insert vote
    const { error: insErr } = await supabase.from("votes").insert({
      matchup_id: matchupId,
      choice_entry_id: choiceEntryId,
      voter_id: voterId,
    });

    if (insErr) {
      throw insErr;
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
