"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function HomeHeaderActions() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      {/* Archive */}
      <Link
        href="/archive"
        className="bb-iconBtn"
        aria-label="Archive"
        style={{ color: "inherit", textDecoration: "none" }}
      >
        <span className="bb-iconGlyph" aria-hidden="true">🗂️</span>
      </Link>

      {/* Info */}
      <button
        type="button"
        className="bb-iconBtn"
        aria-label="Info"
        onClick={() => setOpen(true)}
        style={{ color: "inherit" }}
      >
        <span className="bb-iconGlyph" aria-hidden="true">ⓘ</span>
      </button>

      {open ? (
        <div
          className="bb-modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-label="About Bracket Battle"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bb-modalCard">
            <div className="bb-modalHeader">
              <div className="bb-modalTitle">How Voting Works</div>
              <button
                type="button"
                className="bb-modalClose"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="bb-modalBody">
              <div className="bb-modalSection" style={{ borderTop: "none", paddingTop: 0 }}>
                <div className="bb-modalLabel">Schedule</div>
                <div className="bb-modalText">
                  Round 1: Sun–Mon<br />
                  Round 2: Tue–Wed<br />
                  Round 3: Thu–Fri<br />
                  Final: Saturday
                </div>
              </div>

              <div className="bb-modalSection">
                <div className="bb-modalLabel">Rules</div>
                <div className="bb-modalText">
                  • Voting is always open for the current round.<br />
                  • You can vote once per matchup (then that matchup locks for you).<br />
                  • Results show after you vote in that matchup.
                </div>
              </div>

              <div className="bb-modalSection">
                <div className="bb-modalLabel">Send ideas</div>
                <div className="bb-modalText">
                  Want a theme idea or found a bug? Email{" "}
                  <a
                    href="mailto:bracketbattle88@gmail.com"
                    style={{ textDecoration: "underline", color: "inherit", fontWeight: 900 }}
                  >
                    bracketbattle88@gmail.com
                  </a>
                  .
                </div>
              </div>

              <div className="bb-modalSection">
                <div className="bb-modalLabel">Privacy</div>
                <div className="bb-modalText">
                  Votes are tied to an anonymous browser ID (not your name).
                </div>
              </div>
            </div>

            <div className="bb-modalFooter">
              <button
                type="button"
                className="bb-modalBtn"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
