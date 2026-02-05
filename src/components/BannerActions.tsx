"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function BannerActions({
  topicTitle,
  timeZone = "America/New_York",
}: {
  topicTitle: string;
  timeZone?: string;
}) {
  const [open, setOpen] = useState(false);

  // Lock scroll when modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="bb-bannerRight">
        {/* Archive */}
        <Link href="/archive" className="bb-iconBtn" aria-label="Archive">
          🕒
        </Link>

        {/* About */}
        <button
          type="button"
          className="bb-iconBtn"
          aria-label="About this bracket"
          onClick={() => setOpen(true)}
        >
          i
        </button>
      </div>

      {open ? (
        <div
          className="bb-modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-label="About this bracket"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bb-modalCard">
            <div className="bb-modalHeader">
              <div className="bb-modalTitle">About this bracket</div>
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
              <div className="bb-modalSection">
                <div className="bb-modalLabel">Topic</div>
                <div className="bb-modalText">{topicTitle}</div>
              </div>

              <div className="bb-modalSection">
                <div className="bb-modalLabel">How voting works</div>
                <div className="bb-modalText">
                  Vote once per matchup. Results reveal after you vote. Future
                  rounds are hidden until they’re active.
                </div>
              </div>

              <div className="bb-modalSection">
                <div className="bb-modalLabel">Schedule</div>
                <div className="bb-modalText">
                  Sun–Mon: Round 1 • Tue–Wed: Round 2 • Thu–Fri: Round 3 • Sat:
                  Final (Round 4)
                  <br />
                  Timezone: {timeZone}
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
