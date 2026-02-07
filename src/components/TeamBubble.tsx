"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import VoteButton from "@/app/VoteButton";

type Entry = {
  id: string;
  name: string;
  seed: number;
  description?: string | null;
  image_url?: string | null;
};

type Props = {
  entry: Entry | null;
  count: number;
  pct: number;
  showResults: boolean;
  matchupId: string | null;
  votingOpen: boolean;
  alreadyVoted: boolean;
  compact?: boolean;
  onVoted?: (matchupId: string, entryId: string) => void;
  matchupRound?: number;
  currentRound?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function TeamBubble({
  entry,
  count,
  pct,
  showResults,
  matchupId,
  votingOpen,
  alreadyVoted,
  compact = true,
  onVoted,
  matchupRound,
}: Props) {
  const height = compact ? 54 : 62;
  const safePct = clamp(Math.round(pct), 0, 100);

  const canVote = Boolean(matchupId && entry && votingOpen && !alreadyVoted);
  const reveal = Boolean(showResults || alreadyVoted);

  const [infoOpen, setInfoOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!infoOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInfoOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [infoOpen]);

  useEffect(() => {
    if (!infoOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("bb-modalOpen");

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove("bb-modalOpen");
    };
  }, [infoOpen]);

  const openInfo = () => {
    if (!entry) return;
    setInfoOpen(true);
  };

  const description =
    entry?.description && entry.description.trim().length > 0
      ? entry.description.trim()
      : null;

  const imageUrl =
    entry?.image_url && entry.image_url.trim().length > 0
      ? entry.image_url.trim()
      : null;

  const modal =
    infoOpen && entry ? (
      <div
        className="bb-modalOverlay"
        role="dialog"
        aria-modal="true"
        aria-label={`Info about ${entry.name}`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setInfoOpen(false);
        }}
      >
        <div className="bb-modalCard">
          <div className="bb-modalHeader">
            <div className="bb-modalTitle">{entry.name}</div>
            <button
              type="button"
              className="bb-modalClose"
              aria-label="Close"
              onClick={() => setInfoOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className="bb-modalBody">
            <div className="bb-modalPills">
            <span className="bb-pill">
              <span className="bb-pillLabel">Seed</span>
              <span className="bb-pillValue">{entry.seed}</span>
            </span>
            </div>

            {imageUrl ? (
              <img
                className="bb-modalImage"
                src={imageUrl}
                alt={entry.name}
                loading="lazy"
              />
            ) : null}

            <div className="bb-modalSection">
              <div className="bb-modalLabel">About</div>
              <div className="bb-modalText">
                {description ?? "No description yet."}
              </div>
            </div>
          </div>

          <div className="bb-modalFooter">
            <button
              type="button"
              className="bb-modalBtn"
              onClick={() => setInfoOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <div
        className={`bb-bubble ${!entry ? "placeholder" : ""}`}
        style={{ height }}
        data-reveal={reveal ? "1" : "0"}
        aria-label={entry ? `${entry.name} seed ${entry.seed}` : "TBD"}
      >
        <div
          className="bb-bubbleFill"
          style={{ width: reveal ? `${safePct}%` : "0%" }}
        />

        <div className="bb-bubbleInner">
          <div className="bb-seed bb-seedNudge">
            <div className="bb-seedLabel">SEED</div>
            <div className="bb-seedNum">{entry?.seed ?? "—"}</div>
          </div>

          <div className="bb-titleWrap">
            <div className="bb-titleRow">
              <button
                type="button"
                className="bb-teamName bb-teamNameBtn"
                title={entry?.name ?? "TBD"}
                onClick={openInfo}
                disabled={!entry}
              >
                {entry?.name ?? "TBD"}
              </button>

              <button
                type="button"
                className="bb-infoBtn"
                aria-label={entry ? `More info about ${entry.name}` : "More info"}
                onClick={openInfo}
                disabled={!entry}
              >
                i
              </button>
            </div>

            {!reveal ? (
              <div className="bb-metaRow bb-metaRowEmpty" />
            ) : (
              <div className="bb-metaRow bb-metaRowSplit">
                <span className="bb-countText">
                  {count} {count === 1 ? "vote" : "votes"}
                </span>
                <span className="bb-pctInline">{safePct}%</span>
              </div>
            )}
          </div>

          <div className="bb-right bb-rightNudge">
            {matchupId && entry ? (
              <VoteButton
                matchupId={matchupId}
                entryId={entry.id}
                disabled={!canVote}
                onVoted={onVoted}
                size={matchupRound === 4 ? "small" : "normal"}
              />
            ) : (
              <div className="bb-voteDisabled">Vote</div>
            )}
          </div>
        </div>
      </div>

      {mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
