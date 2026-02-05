"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import BracketBoard from "@/components/BracketBoard";

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type Topic = {
  id: string;
  title: string;
  starts_at: string;
  current_round: number | null;
  status: string | null;
};

export default function ArchiveTopicPageClient() {
  // next/navigation useParams
  const { useParams } = require("next/navigation");
  const params = useParams() as { id?: string };

  const topicId = params?.id;

  const supabase = useMemo(() => supabaseAnon(), []);

  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [matchups, setMatchups] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        if (!topicId) {
          setLoading(false);
          return;
        }

        const { data: t, error: tErr } = await supabase
          .from("topics")
          .select("id,title,starts_at,current_round,status")
          .eq("id", topicId)
          .maybeSingle();

        if (tErr) throw new Error(tErr.message);
        if (!t) throw new Error("Topic not found.");

        const { data: m, error: mErr } = await supabase
          .from("matchups")
          .select(
            `
            id,
            round,
            matchup_index,
            a_entry:entries!matchups_a_entry_id_fkey (
              id,name,seed,description,image_url
            ),
            b_entry:entries!matchups_b_entry_id_fkey (
              id,name,seed,description,image_url
            )
          `
          )
          .eq("topic_id", t.id)
          .order("round", { ascending: true })
          .order("matchup_index", { ascending: true });

        if (mErr) throw new Error(mErr.message);

        const matchupIds = (m ?? []).map((x: any) => x.id);

        const { data: voteRows, error: vErr } = await supabase
          .from("votes")
          .select("matchup_id, choice_entry_id")
          .in(
            "matchup_id",
            matchupIds.length ? matchupIds : ["00000000-0000-0000-0000-000000000000"]
          );

        if (vErr) throw new Error(vErr.message);

        const c: Record<string, number> = {};
        for (const v of voteRows ?? []) {
          const key = `${v.matchup_id}:${v.choice_entry_id}`;
          c[key] = (c[key] ?? 0) + 1;
        }

        if (!alive) return;
        setTopic(t);
        setMatchups(m ?? []);
        setCounts(c);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Unknown error");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [topicId, supabase]);

  if (!topicId) {
    return (
      <main className="bb-page p-6 text-white">
        <div className="text-2xl font-bold">Missing topic id.</div>
        <div className="mt-4">
          <Link href="/archive" className="underline">
            Back
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="bb-page p-6 text-white">
        <div className="text-2xl font-bold">Loading…</div>
      </main>
    );
  }

  if (error || !topic) {
    return (
      <main className="bb-page p-6 text-white">
        <div className="text-2xl font-bold mb-3">Archive error</div>
        <div className="opacity-80 mb-4">{error ?? "Topic not found."}</div>
        <div>
          <Link href="/archive" className="underline">
            Back to archive
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="bb-page">
      <div className="bb-banner">
        <div className="bb-bannerLeft">
          <div className="bb-roundBig">Archive</div>
        </div>

        <div className="bb-bannerCenter">
          <div className="bb-bannerLogo">
            <img src="/logo.png" alt="Bracket Battle" className="bb-logoImg" />
          </div>
          <div className="bb-bannerTopic">
            <div className="bb-tourTitle">
              {topic.title?.toUpperCase?.() ?? topic.title}
            </div>
          </div>
        </div>

        <div className="bb-bannerRight">
          <Link href="/archive" className="bb-iconBtn" aria-label="Back to archive">
            ←
          </Link>
          <div className="bb-iconBtn" aria-hidden>
            🗂️
          </div>
        </div>
      </div>

      <BracketBoard
        currentRound={Math.min(4, topic.current_round ?? 4)}
        votingOpen={false}
        votedMatchupIds={[]}
        matchups={matchups as any}
        counts={counts}
      />
    </main>
  );
}
