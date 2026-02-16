// src/app/archive/[id]/page.tsx
import Link from "next/link";
import BracketBoard from "@/components/BracketBoard";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Topic = {
  id: string;
  title: string | null;
  starts_at: string | null;
  current_round?: number | null;
};

type Entry = {
  id: string;
  name: string;
  seed: number;
  description?: string | null;
  image_url?: string | null;
};

type MatchupRow = {
  id: string;
  round: number;
  matchup_index: number;
  a_entry: Entry | null;
  b_entry: Entry | null;
};

type VoteRow = {
  matchup_id: string;
  choice_entry_id: string;
};

export default async function ArchiveTournamentPage({
  params,
}: {
  params: { id: string };
}) {
  const topicId = params.id;

  const { data: topic, error: topicError } = await supabase
    .from("topics")
    .select("*")
    .eq("id", topicId)
    .single<Topic>();

  if (topicError || !topic) {
    return <main className="bb-page">Tournament not found.</main>;
  }

  const { data: matchupsData, error: matchupsError } = await supabase
    .from("matchups")
    .select(
      `
        id,
        round,
        matchup_index,
        a_entry:entries!matchups_a_entry_id_fkey ( id, name, seed, description, image_url ),
        b_entry:entries!matchups_b_entry_id_fkey ( id, name, seed, description, image_url )
      `
    )
    .eq("topic_id", topic.id)
    .order("round", { ascending: true })
    .order("matchup_index", { ascending: true });

  if (matchupsError) {
    return <main className="bb-page">Error loading tournament</main>;
  }

  const baseMatchups: MatchupRow[] = (matchupsData ?? []).map((m: any) => ({
    id: String(m.id),
    round: Number(m.round),
    matchup_index: Number(m.matchup_index),
    a_entry: m.a_entry ?? null,
    b_entry: m.b_entry ?? null,
  }));

  const matchupIds = baseMatchups.map((m) => m.id);

  const { data: voteRowsData, error: votesError } = await supabase
    .from("votes")
    .select("matchup_id, choice_entry_id")
    .in(
      "matchup_id",
      matchupIds.length ? matchupIds : ["00000000-0000-0000-0000-000000000000"]
    );

  if (votesError) {
    return <main className="bb-page">Error loading votes</main>;
  }

  const voteRows = (voteRowsData ?? []) as VoteRow[];

  const counts: Record<string, number> = {};
  for (const v of voteRows) {
    const key = `${v.matchup_id}:${v.choice_entry_id}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  // archive renders topic’s current round (clamped)
  const roundToRender = Math.min(4, Math.max(1, topic.current_round ?? 1));

  return (
    <main className="bb-page">
      <div className="bb-banner">
        {/* LEFT */}
        <div className="bb-bannerLeft">
          <div className="bb-roundBig">Archive</div>
        </div>

        {/* CENTER */}
        <div className="bb-bannerCenter">
          <div className="bb-bannerLogo">
            <img src="/logo.png" alt="Bracket Battle" className="bb-logoImg" />
          </div>

          <div className="bb-bannerTopic">
            <div className="bb-tourTitle">
              {(topic.title ?? "Tournament").toUpperCase()}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="bb-bannerRight">
          <Link
            href="/archive"
            className="bb-iconBtn"
            aria-label="Back to archive"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            ←
          </Link>
          <Link
            href="/"
            className="bb-iconBtn"
            aria-label="Home"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            🏠
          </Link>
        </div>
      </div>

      <BracketBoard
        currentRound={roundToRender}
        votingOpen={false} // archive is read-only
        votedMatchupIds={[]}
        matchups={baseMatchups}
        counts={counts}
      />
    </main>
  );
}
