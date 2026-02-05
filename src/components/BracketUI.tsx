"use client";

import { useMemo, useState } from "react";

type Entry = {
  id: string;
  name: string;
  seed?: number | null;
};

export type Matchup = {
  id: string;
  round: number;
  matchup_index: number;
  a_entry: Entry;
  b_entry: Entry;
  a_votes: number;
  b_votes: number;
  winner_entry_id: string | null;
  user_voted_entry_id?: string | null;
};

type Props = {
  topicTitle: string;
  currentRound: number;
  // all matchups for this topic (any round)
  matchups: Matchup[];

  // used to disable voting after user voted in that matchup
  onVote: (matchupId: string, entryId: string) => void;

  // optional: show the next round time string you already compute
  nextRoundLabel?: string;
};

function pct(a: number, b: number) {
  const total = a + b;
  if (total <= 0) return { a: 0, b: 0 };
  return { a: Math.round((a / total) * 100), b: Math.round((b / total) * 100) };
}

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

export default function BracketUI({
  topicTitle,
  currentRound,
  matchups,
  onVote,
  nextRoundLabel,
}: Props) {
  const [view, setView] = useState<"bracket" | "cards">("bracket");

  // group matchups by round (for bracket columns)
  const rounds = useMemo(() => {
    const byRound = new Map<number, Matchup[]>();
    for (const m of matchups) {
      if (!byRound.has(m.round)) byRound.set(m.round, []);
      byRound.get(m.round)!.push(m);
    }
    // sort each round by matchup_index
    for (const [r, list] of byRound.entries()) {
      list.sort((x, y) => x.matchup_index - y.matchup_index);
      byRound.set(r, list);
    }
    return byRound;
  }, [matchups]);

  const maxRound = useMemo(() => {
    let max = 1;
    for (const m of matchups) max = Math.max(max, m.round);
    return max;
  }, [matchups]);

  const cardsRoundMatchups = useMemo(() => {
    // show current round cards by default
    const list = rounds.get(currentRound) ?? [];
    return list;
  }, [rounds, currentRound]);

  return (
    <main className="min-h-screen px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <header className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
              {topicTitle}
            </h1>
            <div className="mt-1 text-sm md:text-base opacity-70">
              Round <span className="font-semibold">{currentRound}</span>{" "}
              <span className="opacity-60">/</span>{" "}
              <span className="opacity-70">{Math.max(4, maxRound)}</span>
              {nextRoundLabel ? (
                <>
                  <span className="mx-2 opacity-40">•</span>
                  <span>{nextRoundLabel}</span>
                </>
              ) : null}
            </div>
          </div>

          {/* Desktop toggle */}
          <div className="hidden md:flex gap-2">
            <button
              className={cx(
                "rounded-full px-4 py-2 text-sm border transition",
                view === "bracket" && "bg-black text-white"
              )}
              onClick={() => setView("bracket")}
            >
              Bracket view
            </button>
            <button
              className={cx(
                "rounded-full px-4 py-2 text-sm border transition",
                view === "cards" && "bg-black text-white"
              )}
              onClick={() => setView("cards")}
            >
              Matchups
            </button>
          </div>
        </div>

        {/* Mobile hint */}
        <div className="mt-4 md:hidden rounded-xl border p-3 text-sm opacity-80">
          You’re in matchup mode on mobile. On desktop you’ll also get a full bracket view.
        </div>
      </header>

      <div className="mx-auto mt-6 max-w-6xl">
        {/* Desktop: Bracket + Cards */}
        <div className="hidden md:block">
          {view === "bracket" ? (
            <BracketColumns rounds={rounds} currentRound={currentRound} />
          ) : null}

          {/* Always keep cards available for quick voting */}
          <div className={cx("mt-8", view === "bracket" ? "block" : "block")}>
            <h2 className="text-lg font-semibold">Vote this round</h2>
            <div className="mt-3 grid grid-cols-2 gap-4">
              {cardsRoundMatchups.map((m) => (
                <MatchupCard key={m.id} m={m} onVote={onVote} />
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: Cards only */}
        <div className="md:hidden">
          <h2 className="text-lg font-semibold">Vote this round</h2>
          <div className="mt-3 flex flex-col gap-4">
            {cardsRoundMatchups.map((m) => (
              <MatchupCard key={m.id} m={m} onVote={onVote} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function MatchupCard({
  m,
  onVote,
}: {
  m: Matchup;
  onVote: (matchupId: string, entryId: string) => void;
}) {
  const { a, b } = pct(m.a_votes, m.b_votes);
  const voted = !!m.user_voted_entry_id;

  const aIsWinner = m.winner_entry_id === m.a_entry.id;
  const bIsWinner = m.winner_entry_id === m.b_entry.id;

  return (
    <div className="rounded-2xl border p-4 shadow-sm bg-white">
      <div className="flex items-center justify-between">
        <div className="text-sm opacity-70">
          Round {m.round} • Matchup {m.matchup_index + 1}
        </div>
        {voted ? (
          <span className="text-xs rounded-full border px-2 py-1">
            Voted ✅
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        {/* Option A */}
        <button
          disabled={voted}
          onClick={() => onVote(m.id, m.a_entry.id)}
          className={cx(
            "rounded-xl border p-3 text-left transition",
            voted && "opacity-60 cursor-not-allowed",
            !voted && "hover:bg-gray-50",
            aIsWinner && "border-green-600"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs opacity-60">
                {m.a_entry.seed ? `Seed ${m.a_entry.seed}` : " "}
              </div>
              <div className="font-semibold truncate">{m.a_entry.name}</div>
            </div>
            <div className="text-sm tabular-nums">{m.a_votes}</div>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-gray-900" style={{ width: `${a}%` }} />
          </div>
          <div className="mt-1 text-xs opacity-60">{a}%</div>
        </button>

        <div className="text-center text-xs opacity-50">vs</div>

        {/* Option B */}
        <button
          disabled={voted}
          onClick={() => onVote(m.id, m.b_entry.id)}
          className={cx(
            "rounded-xl border p-3 text-left transition",
            voted && "opacity-60 cursor-not-allowed",
            !voted && "hover:bg-gray-50",
            bIsWinner && "border-green-600"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs opacity-60">
                {m.b_entry.seed ? `Seed ${m.b_entry.seed}` : " "}
              </div>
              <div className="font-semibold truncate">{m.b_entry.name}</div>
            </div>
            <div className="text-sm tabular-nums">{m.b_votes}</div>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-gray-900" style={{ width: `${b}%` }} />
          </div>
          <div className="mt-1 text-xs opacity-60">{b}%</div>
        </button>
      </div>

      {m.winner_entry_id ? (
        <div className="mt-3 text-xs opacity-70">
          Winner:{" "}
          <span className="font-semibold">
            {aIsWinner ? m.a_entry.name : m.b_entry.name}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function BracketColumns({
  rounds,
  currentRound,
}: {
  rounds: Map<number, Matchup[]>;
  currentRound: number;
}) {
  // Show up to 4 rounds visually (16 → 8 → 4 → 2)
  const roundNums = [1, 2, 3, 4].filter((r) => rounds.has(r));

  return (
    <div className="rounded-2xl border p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Bracket</h2>
        <div className="text-sm opacity-70">
          Viewing rounds 1–{roundNums.length} • Current:{" "}
          <span className="font-semibold">{currentRound}</span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[900px] grid grid-cols-4 gap-6">
          {roundNums.map((r) => (
            <div key={r}>
              <div className="text-sm font-semibold mb-3">
                Round {r}
              </div>
              <div className="flex flex-col gap-3">
                {(rounds.get(r) ?? []).map((m) => (
                  <BracketSlot key={m.id} m={m} />
                ))}
              </div>
            </div>
          ))}
          {/* If a later round doesn't exist yet, still show placeholders */}
          {roundNums.length < 4
            ? Array.from({ length: 4 - roundNums.length }).map((_, idx) => (
                <div key={`ph-${idx}`}>
                  <div className="text-sm font-semibold mb-3">
                    Round {roundNums.length + idx + 1}
                  </div>
                  <div className="rounded-xl border p-3 text-sm opacity-50">
                    Not available yet
                  </div>
                </div>
              ))
            : null}
        </div>
      </div>
    </div>
  );
}

function BracketSlot({ m }: { m: Matchup }) {
  const aWin = m.winner_entry_id === m.a_entry.id;
  const bWin = m.winner_entry_id === m.b_entry.id;
  const aVoted = m.user_voted_entry_id === m.a_entry.id;
  const bVoted = m.user_voted_entry_id === m.b_entry.id;

  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs opacity-60 mb-2">
        Matchup {m.matchup_index + 1}
      </div>

      <div className={cx("flex items-center justify-between gap-2", aWin && "font-semibold")}>
        <div className="min-w-0 truncate">
          {m.a_entry.seed ? <span className="opacity-60 mr-2">#{m.a_entry.seed}</span> : null}
          {m.a_entry.name}
          {aVoted ? <span className="ml-2 text-xs opacity-60">(you)</span> : null}
        </div>
        {aWin ? <span className="text-xs text-green-700">WIN</span> : null}
      </div>

      <div className="my-2 h-px bg-gray-100" />

      <div className={cx("flex items-center justify-between gap-2", bWin && "font-semibold")}>
        <div className="min-w-0 truncate">
          {m.b_entry.seed ? <span className="opacity-60 mr-2">#{m.b_entry.seed}</span> : null}
          {m.b_entry.name}
          {bVoted ? <span className="ml-2 text-xs opacity-60">(you)</span> : null}
        </div>
        {bWin ? <span className="text-xs text-green-700">WIN</span> : null}
      </div>
    </div>
  );
}
