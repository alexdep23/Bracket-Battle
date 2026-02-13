"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { getAnonVoterId } from "@/lib/anonVoter";

type Entry = { id: string; name: string; seed: number };
type MatchupRow = {
  id: string;
  round: number;
  matchup_index: number;
  a_entry: Entry | null;
  b_entry: Entry | null;
};

type Topic = {
  id: string;
  title: string;
  starts_at: string;
  current_round: number;
};

type Props = {
  topic: Topic;

  // keep this from your server logic (schedule / dev toggle)
  votingOpen: boolean;

  matchups: MatchupRow[];

  // vote counts that you already compute on the server
  counts: Record<string, number>;

  matchupsError: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts[parts.length - 1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

function bubbleFillPct(aCount: number, bCount: number, which: "a" | "b") {
  const total = aCount + bCount;
  if (total <= 0) return 0;
  const pct = which === "a" ? aCount / total : bCount / total;
  return Math.round(pct * 100);
}

function RoundLabel({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="mb-3">
      <div
        className={`text-xs tracking-[0.35em] uppercase ${
          active ? "text-white/90" : "text-white/55"
        }`}
        style={{ fontFamily: "var(--font-space)" }}
      >
        {label}
      </div>
      <div
        className={`h-[2px] mt-2 rounded-full ${
          active ? "bg-white/35" : "bg-white/15"
        }`}
      />
    </div>
  );
}

function Bubble({
  entry,
  pct,
  countText,
  disabled,
  showFill,
  onVote,
}: {
  entry: Entry;
  pct: number;
  countText: string;
  disabled: boolean;
  showFill: boolean;
  onVote: () => void;
}) {
  return (
    <div className="relative w-[320px] h-[58px] rounded-full glass soft-outline overflow-hidden">
      {/* fill */}
      <div
        className="absolute inset-0"
        style={{
          width: showFill ? `${pct}%` : "0%",
          transition: "width 650ms cubic-bezier(.2,.9,.2,1)",
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.22), rgba(255,255,255,0.10))",
        }}
      />

      {/* content */}
      <div className="relative h-full px-3 flex items-center gap-3">
        {/* photo placeholder */}
        <div className="h-10 w-10 rounded-full pill flex items-center justify-center text-sm font-semibold text-white/90">
          {initials(entry.name)}
        </div>

        {/* seed */}
        <div className="min-w-[44px] text-center">
          <div className="text-[11px] uppercase tracking-widest text-white/55">
            Seed
          </div>
          <div className="text-sm font-semibold text-white/90">{entry.seed}</div>
        </div>

        {/* title centered */}
        <div className="flex-1 text-center">
          <div
            className="text-[15px] font-semibold text-white/95 leading-tight truncate"
            style={{ fontFamily: "var(--font-space)" }}
            title={entry.name}
          >
            {entry.name}
          </div>
          <div className="text-[12px] text-white/60">{countText}</div>
        </div>

        {/* vote */}
        <button
          type="button"
          disabled={disabled}
          onClick={onVote}
          className={`h-9 px-4 rounded-full text-sm font-semibold transition
            ${
              disabled
                ? "bg-white/10 text-white/35"
                : "bg-white/18 hover:bg-white/26 text-white"
            }
          `}
        >
          Vote
        </button>

        {/* pct */}
        <div className="w-[44px] text-right text-sm font-semibold text-white/90">
          {pct}%
        </div>
      </div>
    </div>
  );
}

export default function BracketClient({
  topic,
  votingOpen,
  matchups,
  counts: initialCounts,
  matchupsError,
}: Props) {
  // ✅ voter id must come from the browser (localStorage)
  const [voterId, setVoterId] = useState<string | null>(null);

  // local state so % fills immediately after vote
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);

  // matchups this voter already voted in
  const [voted, setVoted] = useState<Set<string>>(new Set());

  // matchups we can reveal results for (after voting)
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  // 1) get voter id on client
  useEffect(() => {
    setVoterId(getAnonVoterId());
  }, []);

  // 2) load voted matchups for this voter
  useEffect(() => {
    async function loadMyVotes() {
      if (!voterId) return;
      if (matchups.length === 0) return;

      const matchupIds = matchups.map((m) => m.id);

      const { data, error } = await supabase
        .from("votes")
        .select("matchup_id")
        .eq("voter_id", voterId)
        .in("matchup_id", matchupIds);

      if (error) {
        console.error("loadMyVotes error:", error);
        return;
      }

      const votedSet = new Set<string>();
      for (const row of data ?? []) votedSet.add(row.matchup_id);

      setVoted(votedSet);
      setRevealed(new Set(votedSet)); // show fill for already-voted matchups
    }

    loadMyVotes();
  }, [voterId, matchups]);

  const rounds = useMemo(() => {
    const byRound = new Map<number, MatchupRow[]>();
    for (const m of matchups) {
      if (!byRound.has(m.round)) byRound.set(m.round, []);
      byRound.get(m.round)!.push(m);
    }
    for (const [r, arr] of byRound.entries()) {
      arr.sort((a, b) => a.matchup_index - b.matchup_index);
      byRound.set(r, arr);
    }
    const maxRound = Math.max(1, ...Array.from(byRound.keys()));
    return { byRound, maxRound };
  }, [matchups]);

  const totalRows = 16;
  const rowH = 78;

  async function handleVote(matchupId: string, entryId: string) {
    // if voterId isn’t ready yet, do nothing
    if (!voterId) return;

    // optimistic: mark revealed immediately for instant fill animation
    setRevealed((prev) => new Set(prev).add(matchupId));

    // block double-vote locally
    setVoted((prev) => new Set(prev).add(matchupId));

    // optimistic increment
    setCounts((prev) => {
      const next = { ...prev };
      const key = `${matchupId}:${entryId}`;
      next[key] = (next[key] ?? 0) + 1;
      return next;
    });

try {
  const res = await fetch("/api/vote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      matchupId,
      choiceEntryId: entryId,
      voterId,
    }),
  });

  const json = await res.json();

  // duplicate vote → treat as already voted, keep UI disabled
  if (res.status === 409) return;

  if (!res.ok || !json.ok) {
    throw new Error(json?.error ?? "Vote failed");
  }
} catch (err: any) {
  // rollback on real error
  setVoted((prev) => {
    const n = new Set(prev);
    n.delete(matchupId);
    return n;
  });
  setCounts((prev) => {
    const next = { ...prev };
    const key = `${matchupId}:${entryId}`;
    next[key] = Math.max(0, (next[key] ?? 1) - 1);
    return next;
  });
  alert(`Vote failed: ${err?.message ?? String(err)}`);
}

  const headerStarts = new Date(topic.starts_at).toLocaleString();

  return (
    <main className="min-h-screen p-6 sm:p-10">
      {/* Header card */}
      <div className="mx-auto max-w-[1400px] glass rounded-[28px] px-6 sm:px-10 py-6 sm:py-7">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex items-center">
            <div
              className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white/95"
              style={{ fontFamily: "var(--font-sora)" }}
            >
              Round {topic.current_round}
            </div>
          </div>

          <div className="text-center">
            <div
              className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white"
              style={{ fontFamily: "var(--font-sora)" }}
            >
              Bracket Battle
            </div>
            <div
              className="mt-1 text-sm sm:text-base tracking-[0.35em] uppercase text-white/75"
              style={{ fontFamily: "var(--font-space)" }}
            >
              {topic.title}
            </div>
            <div className="mt-1 text-sm text-white/70">
              Starts {headerStarts} • {votingOpen ? "Voting open" : "Voting closed"}
            </div>

            {/* Tiny debug line so you can SEE it’s working */}
            <div className="mt-1 text-xs text-white/50">
              voterId: {voterId ? `${voterId.slice(0, 8)}…` : "loading..."}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <div className="pill rounded-full h-10 w-10 grid place-items-center text-white/80">
              🕒
            </div>
            <div className="pill rounded-full h-10 w-10 grid place-items-center text-white/80">
              ⓘ
            </div>
          </div>
        </div>
      </div>

      {matchupsError ? (
        <pre className="mx-auto max-w-[1400px] mt-6 rounded-xl bg-black/30 p-4 text-sm overflow-auto">
          {matchupsError}
        </pre>
      ) : null}

      <div className="mx-auto max-w-[1400px] mt-6">
        <div className="glass rounded-[24px] p-5 sm:p-6">
          <div className="overflow-x-auto">
            <div className="min-w-[1200px]">
              <div className="grid grid-cols-4 gap-8">
                {[1, 2, 3, 4].map((r) => {
                  const ms = rounds.byRound.get(r) ?? [];
                  const matchupCount =
                    ms.length || (r === 1 ? 8 : r === 2 ? 4 : r === 3 ? 2 : 1);
                  const groupSize = 2 ** r;

                  return (
                    <div key={r}>
                      <RoundLabel label={`Round ${r}`} active={r === topic.current_round} />

                      <div
                        className="grid relative"
                        style={{
                          gridTemplateRows: `repeat(${totalRows}, ${rowH}px)`,
                        }}
                      >
                        {Array.from({ length: matchupCount }).map((_, idx) => {
                          const matchup = ms[idx];
                          const a = matchup?.a_entry ?? null;
                          const b = matchup?.b_entry ?? null;

                          let top = a;
                          let bot = b;
                          if (a && b && a.seed > b.seed) {
                            top = b;
                            bot = a;
                          }

                          const rowStart = idx * groupSize + 1;

                          const topCount =
                            matchup && top ? counts[`${matchup.id}:${top.id}`] ?? 0 : 0;
                          const botCount =
                            matchup && bot ? counts[`${matchup.id}:${bot.id}`] ?? 0 : 0;

                          const topPct = bubbleFillPct(topCount, botCount, "a");
                          const botPct = bubbleFillPct(topCount, botCount, "b");

                          const alreadyVoted = matchup ? voted.has(matchup.id) : false;
                          const showResults = matchup ? revealed.has(matchup.id) : false;

                          const canVoteThisRound = r === topic.current_round;

                          return (
                            <div
                              key={`${r}-${idx}`}
                              className="flex flex-col justify-between"
                              style={{
                                gridRow: `${rowStart} / span ${groupSize}`,
                                paddingTop: 8,
                                paddingBottom: 8,
                              }}
                            >
                              {top ? (
                                <Bubble
                                  entry={top}
                                  pct={showResults ? topPct : 0}
                                  countText={`${topCount} vote${topCount === 1 ? "" : "s"}`}
                                  disabled={
                                    !matchup ||
                                    !canVoteThisRound ||
                                    !votingOpen ||
                                    alreadyVoted ||
                                    !voterId // disable until voterId loads
                                  }
                                  showFill={showResults}
                                  onVote={() => {
                                    if (!matchup) return;
                                    handleVote(matchup.id, top!.id);
                                  }}
                                />
                              ) : (
                                <div className="w-[320px] h-[58px] rounded-full pill opacity-30" />
                              )}

                              {bot ? (
                                <Bubble
                                  entry={bot}
                                  pct={showResults ? botPct : 0}
                                  countText={`${botCount} vote${botCount === 1 ? "" : "s"}`}
                                  disabled={
                                    !matchup ||
                                    !canVoteThisRound ||
                                    !votingOpen ||
                                    alreadyVoted ||
                                    !voterId
                                  }
                                  showFill={showResults}
                                  onVote={() => {
                                    if (!matchup) return;
                                    handleVote(matchup.id, bot!.id);
                                  }}
                                />
                              ) : (
                                <div className="w-[320px] h-[58px] rounded-full pill opacity-30" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 text-sm text-white/60">
                Voting days: Sunday, Tuesday, Thursday, Saturday (12:00 AM ET).
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
