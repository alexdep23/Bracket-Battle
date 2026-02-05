"use client";

import VoteButton from "../app/VoteButton";

type Entry = {
  id: string;
  name: string;
  seed: number;
};

type Props = {
  entry: Entry;
  count: number;        // vote count for THIS entry in THIS matchup
  pct: number;          // percent (0-100) for THIS entry in THIS matchup
  fillPct: number;      // animated fill target (0-100) for THIS entry
  showResults: boolean; // parent “results allowed” flag
  matchupId: string;
  votingOpen: boolean;
  alreadyVoted: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function titleSizeClass(name: string) {
  const len = name.trim().length;
  if (len >= 22) return "text-[18px] sm:text-[20px]";
  if (len >= 16) return "text-[20px] sm:text-[22px]";
  return "text-[22px] sm:text-[24px]";
}

export default function MatchupBubble({
  entry,
  count,
  pct,
  fillPct,
  showResults,
  matchupId,
  votingOpen,
  alreadyVoted,
}: Props) {
  const safePct = clamp(Math.round(pct), 0, 100);

  // ✅ Only reveal results AFTER the user has voted (avoids bias)
  const reveal = Boolean(showResults && alreadyVoted);

  console.log("MATCHUP BUBBLE RENDERING ✅", entry.name, { reveal, pct, fillPct });

  return (
    <div className="relative w-[360px] sm:w-[380px]">
      {/* Bubble shell */}
      <div className="relative overflow-hidden rounded-[999px] border border-white/15 bg-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur">
        {/* Percentage fill (ONLY after vote) */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0"
          style={{
            width: `${clamp(reveal ? fillPct : 0, 0, 100)}%`,
            background: "rgba(255,255,255,0.18)",
            transition: "width 520ms cubic-bezier(.2,.9,.2,1)",
          }}
        />

        {/* Content row */}
        <div className="relative flex items-center gap-4 px-5 py-3">
          {/* Seed block */}
          <div className="flex w-[72px] shrink-0 flex-col items-center justify-center leading-none">
            <div className="text-[12px] font-semibold tracking-[0.28em] text-white/70">
              SEED
            </div>
            <div className="mt-1 text-[22px] font-extrabold text-white">
              {entry.seed}
            </div>
          </div>

          {/* Title + (after vote) meta row */}
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
            <div
              className={[
                "w-full truncate text-center font-extrabold text-white",
                titleSizeClass(entry.name),
              ].join(" ")}
              title={entry.name}
            >
              {entry.name}
            </div>

            {/* Meta row (ONLY after vote) */}
            {reveal && (
              <div className="mt-[3px] w-full">
                <div className="relative h-[22px]">
                  {/* Vote count slides in and then sits slightly left */}
                  <div
                    className={[
                      "absolute top-1/2 -translate-y-1/2",
                      "left-1/2 -translate-x-1/2",
                      "text-[14px] font-semibold text-white/80",
                      "transition-all duration-300 ease-out",
                      // push left a bit so % has space on the right
                      "left-[44%]",
                    ].join(" ")}
                  >
                    {count === 1 ? "1 vote" : `${count} votes`}
                  </div>

                  {/* Percent appears on the right */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 text-[18px] font-extrabold text-white">
                    {safePct}%
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Vote button (always visible; will disable when closed/alreadyVoted depending on your VoteButton logic) */}
          <div className="flex w-[88px] shrink-0 items-center justify-end">
            <VoteButton
              matchupId={matchupId}
              entryId={entry.id}
              disabled={!votingOpen || alreadyVoted}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
