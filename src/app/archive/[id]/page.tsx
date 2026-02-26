import Link from "next/link";
import BracketBoard from "@/components/BracketBoard";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Topic = {
  id: string;
  title: string | null;
  starts_at: string | null;
  status: string;
  current_round?: number | null;
  winner_entry_id?: string | null;
};

type Entry = {
  id: string;
  name: string;
  seed: number;
  description?: string | null;
  image_url?: string | null;
};

type MatchupRaw = {
  id: string;
  round: number;
  matchup_index: number;
  a_entry_id: string | null;
  b_entry_id: string | null;
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

  // Past-only: archived + finished (includes interrupted archived tournaments)
  const { data: topic, error: topicError } = await supabase
    .from("topics")
    .select("id,title,starts_at,status,current_round,winner_entry_id")
    .eq("id", topicId)
    .in("status", ["archived", "finished"])
    .maybeSingle();

  if (topicError) {
    return <main className="bb-page">Error loading tournament.</main>;
  }

  if (!topic) {
    return <main className="bb-page">Tournament not found.</main>;
  }

  // 1) Load matchups WITHOUT FK-name-specific joins
  const { data: matchupsData, error: matchupsError } = await supabase
    .from("matchups")
    .select("id, round, matchup_index, a_entry_id, b_entry_id")
    .eq("topic_id", topic.id)
    .order("round", { ascending: true })
    .order("matchup_index", { ascending: true });

  if (matchupsError) {
    return (
      <main className="bb-page">
        Error loading tournament: {matchupsError.message}
      </main>
    );
  }

  const matchupsRaw = (matchupsData ?? []) as MatchupRaw[];

  // 2) Load all referenced entries in one query
  const entryIds = Array.from(
    new Set(
      matchupsRaw
        .flatMap((m) => [m.a_entry_id, m.b_entry_id])
        .filter((x): x is string => !!x)
    )
  );

  let entryMap: Record<string, Entry> = {};
  if (entryIds.length > 0) {
    const { data: entriesData, error: entriesError } = await supabase
      .from("entries")
      .select("id,name,seed,description,image_url")
      .in("id", entryIds);

    if (entriesError) {
      return (
        <main className="bb-page">
          Error loading entries: {entriesError.message}
        </main>
      );
    }

    for (const e of (entriesData ?? []) as Entry[]) {
      entryMap[e.id] = e;
    }
  }

  const baseMatchups: MatchupRow[] = matchupsRaw.map((m) => ({
    id: String(m.id),
    round: Number(m.round),
    matchup_index: Number(m.matchup_index),
    a_entry: m.a_entry_id ? entryMap[m.a_entry_id] ?? null : null,
    b_entry: m.b_entry_id ? entryMap[m.b_entry_id] ?? null : null,
  }));

  // votes -> counts
  const matchupIds = baseMatchups.map((m) => m.id);

  const { data: voteRowsData, error: votesError } = await supabase
    .from("votes")
    .select("matchup_id, choice_entry_id")
    .in(
      "matchup_id",
      matchupIds.length ? matchupIds : ["00000000-0000-0000-0000-000000000000"]
    );

  if (votesError) {
    return <main className="bb-page">Error loading votes: {votesError.message}</main>;
  }

  const voteRows = (voteRowsData ?? []) as VoteRow[];

  const counts: Record<string, number> = {};
  for (const v of voteRows) {
    const key = `${v.matchup_id}:${v.choice_entry_id}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const roundToRender = Math.min(4, Math.max(1, topic.current_round ?? 1));
  const showInterrupted = topic.status === "archived" && !topic.winner_entry_id;

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
              {(topic.title ?? "Tournament").toUpperCase()}
            </div>
          </div>
        </div>

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

      {showInterrupted && (
        <div
          style={{
            margin: "12px auto 16px",
            maxWidth: 1200,
            padding: "12px 16px",
            borderRadius: 12,
            background: "rgba(255, 200, 200, 0.12)",
            border: "1px solid rgba(255, 180, 180, 0.35)",
            color: "rgba(255,255,255,0.9)",
            textAlign: "center",
            fontWeight: 600,
          }}
        >
          Voting was interrupted — no winner was chosen for this tournament.
        </div>
      )}

      <BracketBoard
        currentRound={roundToRender}
        votingOpen={false}
        votedMatchupIds={[]}
        matchups={baseMatchups as any}
        counts={counts}
      />
    </main>
  );
}