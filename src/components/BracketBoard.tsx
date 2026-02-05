"use client";

import { useEffect, useMemo, useState } from "react";
import TeamBubble from "@/components/TeamBubble";
import { createClient } from "@supabase/supabase-js";
import { getAnonVoterId } from "@/lib/anonVoter";

type Entry = {
  id: string;
  name: string;
  seed: number;
  description: string | null;
  image_url: string | null;
};

type MatchupRow = {
  id: string;
  round: number;
  matchup_index: number;
  a_entry: Entry | null;
  b_entry: Entry | null;
};

type Props = {
  currentRound: number;
  votingOpen: boolean;
  votedMatchupIds: string[]; // ✅ server-provided initial voted matchups for this voter (from cookie)
  matchups: MatchupRow[];
  counts: Record<string, number>;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// higher seed (smaller number) goes on top
function sortPair(a: Entry | null, b: Entry | null) {
  if (!a && !b) return [null, null] as const;
  if (a && !b) return [a, null] as const;
  if (!a && b) return [b, null] as const;
  return a!.seed <= b!.seed ? ([a, b] as const) : ([b, a] as const);
}

export default function BracketBoard({
  currentRound,
  votingOpen,
  votedMatchupIds,
  matchups,
  counts: initialCounts,
}: Props) {
  const [localCounts, setLocalCounts] =
    useState<Record<string, number>>(initialCounts);

  // ✅ start with server-known voted matchups (prevents flicker + enables “already voted” immediately)
  const [localVoted, setLocalVoted] = useState<Set<string>>(
    new Set(votedMatchupIds)
  );

  // ✅ client voter id
  const [voterId, setVoterId] = useState<string | null>(null);

  // ✅ MOBILE ONLY
  const [isMobile, setIsMobile] = useState(false);
  const [mobileRound, setMobileRound] = useState<1 | 2 | 3 | 4>(
    (Math.min(4, Math.max(1, currentRound)) as 1 | 2 | 3 | 4) ?? 1
  );

  // ✅ get voter id on mount
  useEffect(() => {
    setVoterId(getAnonVoterId());
  }, []);

  // ✅ detect mobile (does not affect desktop)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobile(mq.matches);
    apply();

    const onChange = () => apply();
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", onChange);
    else mq.addListener(onChange);

    return () => {
      if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  // ✅ if currentRound changes (new day), mobile should jump to the new current round
  useEffect(() => {
    setMobileRound((Math.min(4, Math.max(1, currentRound)) as 1 | 2 | 3 | 4) ?? 1);
  }, [currentRound]);

  // ✅ If server-provided votedMatchupIds changes (rare), sync it once
  useEffect(() => {
    setLocalVoted(new Set(votedMatchupIds));
  }, [votedMatchupIds]);

  // OPTIONAL safety: confirm voted matchups from DB (kept, but does NOT clear localVoted)
  // This avoids overwriting the optimistic vote.
  useEffect(() => {
    async function loadVotedMatchups() {
      if (!voterId) return;
      if (!matchups.length) return;

      const matchupIds = matchups.map((m) => m.id);

      const { data, error } = await supabase
        .from("votes")
        .select("matchup_id")
        .eq("voter_id", voterId)
        .in("matchup_id", matchupIds);

      if (error) {
        console.error("loadVotedMatchups error:", error);
        return;
      }

      // Merge, do not replace (prevents “flash then disappear”)
      setLocalVoted((prev) => {
        const next = new Set(prev);
        for (const row of data ?? []) next.add(row.matchup_id);
        return next;
      });
    }

    loadVotedMatchups();
  }, [voterId, matchups]);

  const rounds = [1, 2, 3, 4] as const;
  const desiredMatchupsCount = (round: number) =>
    Math.max(1, Math.floor(8 / Math.pow(2, round - 1)));

  const matchupsPerRound = useMemo(() => {
    const map = new Map<number, MatchupRow[]>();
    for (const m of matchups) {
      const arr = map.get(m.round) ?? [];
      arr.push(m);
      map.set(m.round, arr);
    }
    for (const [r, arr] of map.entries()) {
      arr.sort((a, b) => a.matchup_index - b.matchup_index);
      map.set(r, arr);
    }
    return map;
  }, [matchups]);

  const roundMatchups = useMemo(() => {
    const out: Record<number, (MatchupRow | null)[]> = {};
    for (const r of rounds) {
      const have = matchupsPerRound.get(r) ?? [];
      const want = desiredMatchupsCount(r);
      const filled: (MatchupRow | null)[] = [];
      for (let i = 0; i < want; i++) filled.push(have[i] ?? null);
      out[r] = filled;
    }
    return out;
  }, [matchupsPerRound]);

  // ===== Layout constants (UNCHANGED) =====
  const ROW_H = 66;
  const COL_W = 360;
  const TOP_PAD = 30;
  const BUBBLE_H = 54;
  const totalHeight = TOP_PAD + 16 * ROW_H + 34;

  const centerOfMatchup = (round: number, matchupIndex: number): number => {
    if (round === 1) {
      const topTeamCenter = 2 * matchupIndex * ROW_H + BUBBLE_H / 2;
      const botTeamCenter = (2 * matchupIndex + 1) * ROW_H + BUBBLE_H / 2;
      return (topTeamCenter + botTeamCenter) / 2;
    }
    const feederA = centerOfMatchup(round - 1, matchupIndex * 2);
    const feederB = centerOfMatchup(round - 1, matchupIndex * 2 + 1);
    return (feederA + feederB) / 2;
  };

  const centerOfTeam = (
    round: number,
    matchupIndex: number,
    pos: 0 | 1
  ): number => {
    if (round === 1) {
      return (2 * matchupIndex + pos) * ROW_H + BUBBLE_H / 2;
    }
    return centerOfMatchup(round - 1, matchupIndex * 2 + pos);
  };

  const topForTeam = (round: number, matchupIndex: number, pos: 0 | 1) => {
    const center = centerOfTeam(round, matchupIndex, pos);
    return TOP_PAD + center - BUBBLE_H / 2;
  };

  const matchupBands = Array.from({ length: 8 }).map((_, i) => {
    const top = TOP_PAD + 2 * i * ROW_H - 6;
    return (
      <div
        key={`band-${i}`}
        className="bb-band"
        style={{
          top,
          height: 2 * ROW_H + 12,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
    );
  });

  const getStats = (
    round: number,
    matchupId: string | null,
    entry: Entry | null
  ) => {
    if (!matchupId || !entry) {
      return { count: 0, pct: 0, showResults: false, alreadyVoted: false };
    }

    const count = localCounts[`${matchupId}:${entry.id}`] ?? 0;

    let total = 0;
    for (const k of Object.keys(localCounts)) {
      if (k.startsWith(`${matchupId}:`)) total += localCounts[k] ?? 0;
    }

    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const alreadyVoted = localVoted.has(matchupId);

    // future rounds: nothing
    if (round > currentRound) {
      return { count: 0, pct: 0, showResults: false, alreadyVoted: false };
    }

    // past rounds: always show results
    if (round < currentRound) {
      return { count, pct, showResults: true, alreadyVoted: false };
    }

    // current round: only show after vote
    return { count, pct, showResults: alreadyVoted, alreadyVoted };
  };

  const handleVoted = (matchupId: string, entryId: string) => {
    // ✅ lock the matchup immediately
    setLocalVoted((prev) => {
      const next = new Set(prev);
      next.add(matchupId);
      return next;
    });

    // ✅ optimistic counts so fill animates immediately
    setLocalCounts((prev) => {
      const next = { ...prev };
      const key = `${matchupId}:${entryId}`;
      next[key] = (next[key] ?? 0) + 1;
      return next;
    });
  };

  const RoundCol = (round: 1 | 2 | 3 | 4) => {
    const mArr = roundMatchups[round] ?? [];
    const want = desiredMatchupsCount(round);

    // ✅ only current round is votable
    const votingOpenForThisRound = votingOpen && round === currentRound;

    // ✅ desktop unchanged width; mobile uses full width
    const colStyle: React.CSSProperties = { width: isMobile ? "100%" : COL_W };

    return (
      <div className="bb-col" style={colStyle}>
        <div className="bb-colHeader">ROUND {round}</div>

        <div className="bb-colBody" style={{ height: totalHeight }}>
          {round === 1 ? matchupBands : null}

          {Array.from({ length: want }).map((_, mi) => {
            const m = mArr[mi] ?? null;
            const [topEntry, botEntry] = sortPair(
              m?.a_entry ?? null,
              m?.b_entry ?? null
            );

            const topY = topForTeam(round, mi, 0);
            const botY = topForTeam(round, mi, 1);

            const topStats = getStats(round, m?.id ?? null, topEntry);
            const botStats = getStats(round, m?.id ?? null, botEntry);

            return (
              <div key={`${round}-${mi}`}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: topY,
                    width: "100%",
                    zIndex: 2,
                  }}
                >
                  <TeamBubble
                    entry={topEntry}
                    matchupId={m?.id ?? null}
                    votingOpen={votingOpenForThisRound}
                    alreadyVoted={topStats.alreadyVoted}
                    count={topStats.count}
                    pct={topStats.pct}
                    showResults={topStats.showResults}
                    onVoted={handleVoted}
                    compact
                    matchupRound={round}
                    currentRound={currentRound}
                  />
                </div>

                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: botY,
                    width: "100%",
                    zIndex: 2,
                  }}
                >
                  <TeamBubble
                    entry={botEntry}
                    matchupId={m?.id ?? null}
                    votingOpen={votingOpenForThisRound}
                    alreadyVoted={botStats.alreadyVoted}
                    count={botStats.count}
                    pct={botStats.pct}
                    showResults={botStats.showResults}
                    onVoted={handleVoted}
                    compact
                    matchupRound={round}
                    currentRound={currentRound}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const MobileRoundPicker = () => (
    <div className="bb-mobileRounds" role="tablist" aria-label="Rounds">
      {([1, 2, 3, 4] as const).map((r) => {
        const active = mobileRound === r;
        return (
          <button
            key={r}
            type="button"
            className={`bb-mobileRoundBtn ${active ? "active" : ""}`}
            onClick={() => {
              setMobileRound(r);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            aria-pressed={active}
          >
            R{r}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="bb-boardWrap">
      {isMobile ? (
        <>
          <MobileRoundPicker />
          <div className="bb-board bb-boardMobile">{RoundCol(mobileRound)}</div>
        </>
      ) : (
        <div className="bb-board">
          {RoundCol(1)}
          {RoundCol(2)}
          {RoundCol(3)}
          {RoundCol(4)}
        </div>
      )}
    </div>
  );
}
