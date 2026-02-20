import BracketBoard from "@/components/BracketBoard";
import HomeHeaderActions from "@/components/HomeHeaderActions";
import NextRoundTimer from "@/components/NextRoundTimer";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function clampRound(n: number) {
  return Math.min(4, Math.max(1, n));
}

export default async function Home() {
  // 1) ONLY show the currently active topic.
  // If none are active, we show a temporary "paused" message (auto-resumes when next topic becomes active).
  const { data: topic, error: topicErr } = await supabase
    .from("topics")
    .select("id,title,starts_at,current_round,status")
    .eq("status", "active")
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (topicErr) {
    return <main className="bb-page">Error loading topic</main>;
  }

  if (!topic) {
    return (
      <main className="bb-page">
        {/* Temporary pause banner (auto-goes away when a topic becomes active) */}
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
          Bracket Battle is temporarily paused due to a scheduling issue. The
          current tournament was archived without a winner. A new tournament
          will start automatically at the next scheduled start time.
        </div>

        <div className="bb-banner">
          {/* LEFT */}
          <div className="bb-bannerLeft">
            <div className="bb-roundBig">Paused</div>
          </div>

          {/* CENTER */}
          <div className="bb-bannerCenter">
            <div className="bb-bannerLogo">
              <img src="/logo.png" alt="Bracket Battle" className="bb-logoImg" />
            </div>

            <div className="bb-bannerTopic">
              <div className="bb-tourTitle">NO ACTIVE TOURNAMENT</div>
            </div>

            <div className="bb-bannerMeta">
              <div className="bb-meta">
                <NextRoundTimer />
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="bb-bannerRight">
            <HomeHeaderActions />
          </div>
        </div>
      </main>
    );
  }

  const activeTopic = topic as Topic;

  // 2) Load matchups for the active topic
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
    .eq("topic_id", activeTopic.id)
    .order("round", { ascending: true })
    .order("matchup_index", { ascending: true });

  if (matchupsError) {
    return <main className="bb-page">Error loading matchups</main>;
  }

  // If the topic is active but matchups aren’t ready yet, show a gentle “initializing” state.
  const hasAnyMatchups = (matchupsData ?? []).length > 0;
  if (!hasAnyMatchups) {
    return (
      <main className="bb-page">
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
          New tournament is starting… initializing bracket.
        </div>

        <div className="bb-banner">
          <div className="bb-bannerLeft">
            <div className="bb-roundBig">Round 1</div>
          </div>

          <div className="bb-bannerCenter">
            <div className="bb-bannerLogo">
              <img src="/logo.png" alt="Bracket Battle" className="bb-logoImg" />
            </div>

            <div className="bb-bannerTopic">
              <div className="bb-tourTitle">
                {activeTopic.title?.toUpperCase?.() ?? activeTopic.title}
              </div>
            </div>

            <div className="bb-bannerMeta">
              <div className="bb-meta">
                <NextRoundTimer />
              </div>
            </div>
          </div>

          <div className="bb-bannerRight">
            <HomeHeaderActions />
          </div>
        </div>
      </main>
    );
  }

  // 3) Current round should come from DB (not schedule-derived).
  const currentRound = clampRound(activeTopic.current_round ?? 1);

  // Keep your current behavior here (you can re-tighten later if you want)
  const votingOpen = true;

  const baseMatchups: MatchupRow[] = (matchupsData ?? []).map((m: any) => ({
    id: String(m.id),
    round: Number(m.round),
    matchup_index: Number(m.matchup_index),
    a_entry: m.a_entry ?? null,
    b_entry: m.b_entry ?? null,
  }));

  // 4) votes -> counts (for bars / UI)
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

  return (
    <main className="bb-page">
      {/* Maintenance banner (keep this; you can remove later) */}
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
        Experiencing technical difficulties — please check back later.
      </div>

      <div className="bb-banner">
        {/* LEFT */}
        <div className="bb-bannerLeft">
          <div className="bb-roundBig">Round {currentRound}</div>
        </div>

        {/* CENTER */}
        <div className="bb-bannerCenter">
          <div className="bb-bannerLogo">
            <img src="/logo.png" alt="Bracket Battle" className="bb-logoImg" />
          </div>

          <div className="bb-bannerTopic">
            <div className="bb-tourTitle">
              {activeTopic.title?.toUpperCase?.() ?? activeTopic.title}
            </div>
          </div>

          <div className="bb-bannerMeta">
            <div className="bb-meta">
              <NextRoundTimer />
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="bb-bannerRight">
          <HomeHeaderActions />
        </div>
      </div>

      <BracketBoard
        currentRound={currentRound}
        votingOpen={votingOpen}
        votedMatchupIds={[]}
        matchups={baseMatchups as any}
        counts={counts}
      />
    </main>
  );
}