import BracketBoard from "@/components/BracketBoard";
import HomeHeaderActions from "@/components/HomeHeaderActions";
import NextRoundTimer from "@/components/NextRoundTimer";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TZ = "America/New_York";

/** Get current weekday in ET (0=Sun .. 6=Sat) */
function getETDay(now: Date) {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(now);

  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return map[wd] ?? now.getDay();
}

/** Round schedule in ET (changes at 12:00 AM ET) */
function scheduledRoundET(now: Date) {
  const day = getETDay(now);
  if (day === 0 || day === 1) return 1; // Sun/Mon
  if (day === 2 || day === 3) return 2; // Tue/Wed
  if (day === 4 || day === 5) return 3; // Thu/Fri
  return 4; // Sat
}

function clampRound(n: number) {
  return Math.min(4, Math.max(1, n));
}

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

export default async function Home() {
  const now = new Date();
  const nowIso = now.toISOString();

  // 1) Pull the last couple started topics, newest first
  const { data: topics, error: topicsError } = await supabase
    .from("topics")
    .select("id,title,starts_at,current_round")
    .not("starts_at", "is", null)
    .lte("starts_at", nowIso)
    .order("starts_at", { ascending: false })
    .limit(2);

  if (topicsError || !topics?.length) {
    return <main className="bb-page">No active topic</main>;
  }

  // 2) Pick the first topic that actually has Round 1 entries populated.
  //    This prevents the banner switching early to a new topic while matchups are still TBD.
  let topic: Topic | null = null;
  let matchupsData: any[] | null = null;

  for (const candidate of topics as Topic[]) {
    const { data, error } = await supabase
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
      .eq("topic_id", candidate.id)
      .order("round", { ascending: true })
      .order("matchup_index", { ascending: true });

    if (error) continue;

    const hasAnyRealRound1 =
      (data ?? []).some((m: any) => Number(m.round) === 1 && (m.a_entry || m.b_entry)) ?? false;

    if (hasAnyRealRound1) {
      topic = candidate;
      matchupsData = data ?? [];
      break;
    }
  }

  // If newest is empty and previous also empty, just use newest anyway (shows TBD rather than crashing)
  if (!topic) {
    topic = (topics[0] as Topic) ?? null;
    const { data, error } = await supabase
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
      .eq("topic_id", topic?.id ?? "")
      .order("round", { ascending: true })
      .order("matchup_index", { ascending: true });

    if (error || !topic) {
      return <main className="bb-page">No active topic</main>;
    }
    matchupsData = data ?? [];
  }

  // 3) Compute current round:
  //    - DB round = what cron/RPC advanced to
  //    - Scheduled round = what your ET calendar says it *should* be
  //    Use whichever is further along so the site "keeps moving" even if cron fails.
  const dbRound = clampRound(topic.current_round ?? 1);
  const schedRound = clampRound(scheduledRoundET(now));
  const currentRound = Math.max(dbRound, schedRound);

  // Keep always-open for now (you can add rules later)
  const votingOpen = true;

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

  // ---------- DERIVE ADVANCEMENT (display-only, resilient) ----------
  function winnerOf(m: MatchupRow): Entry | null {
    // byes / missing side
    if (m.a_entry && !m.b_entry) return m.a_entry;
    if (!m.a_entry && m.b_entry) return m.b_entry;
    if (!m.a_entry || !m.b_entry) return null;

    const aVotes = counts[`${m.id}:${m.a_entry.id}`] ?? 0;
    const bVotes = counts[`${m.id}:${m.b_entry.id}`] ?? 0;

    // if nobody voted, don't invent a winner yet
    if (aVotes === 0 && bVotes === 0) return null;

    // tie -> higher seed wins (lower number)
    if (aVotes === bVotes) {
      return m.a_entry.seed <= m.b_entry.seed ? m.a_entry : m.b_entry;
    }

    return aVotes > bVotes ? m.a_entry : m.b_entry;
  }

  const byRound = new Map<number, MatchupRow[]>();
  for (const m of baseMatchups) {
    const arr = byRound.get(m.round) ?? [];
    arr.push(m);
    byRound.set(m.round, arr);
  }
  for (const [r, arr] of byRound.entries()) {
    arr.sort((a, b) => a.matchup_index - b.matchup_index);
    byRound.set(r, arr);
  }

  // winners for completed rounds only (strictly before currentRound)
  const winnersByRound: Record<number, Record<number, Entry | null>> = {};
  for (let r = 1; r < currentRound; r++) {
    winnersByRound[r] = {};
    const roundMatchups = byRound.get(r) ?? [];
    for (const m of roundMatchups) {
      winnersByRound[r][m.matchup_index] = winnerOf(m);
    }
  }

  // Copy matchups then patch future rounds for display
  const derivedMatchups: MatchupRow[] = baseMatchups.map((m) => ({ ...m }));

  function findDerived(round: number, idx: number) {
    return derivedMatchups.find((m) => m.round === round && m.matchup_index === idx);
  }

  // Fill rounds 2..4 using winners from prior rounds (only exists for rounds < currentRound)
  for (let r = 2; r <= 4; r++) {
    const prevWinners = winnersByRound[r - 1];
    if (!prevWinners) continue;

    const roundMatchups = byRound.get(r) ?? [];
    for (const m of roundMatchups) {
      // matchup_index is 1-based in your DB
      const prevA = prevWinners[m.matchup_index * 2 - 1] ?? null;
      const prevB = prevWinners[m.matchup_index * 2] ?? null;

      const target = findDerived(r, m.matchup_index);
      if (!target) continue;

      if (prevA) target.a_entry = prevA;
      if (prevB) target.b_entry = prevB;
    }
  }
  // ------------------------------------------------------

  return (
    <main className="bb-page">
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
              {topic.title?.toUpperCase?.() ?? topic.title}
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
        matchups={derivedMatchups as any}
        counts={counts}
      />
    </main>
  );
}
