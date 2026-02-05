import Link from "next/link";
import { supabase } from "@/lib/supabase";

type TopicRow = {
  id: string;
  title: string;
  starts_at: string;
  status?: string | null;
  current_round?: number | null;
};

function formatDate(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function ArchivePage() {
  const nowIso = new Date().toISOString();

  // ✅ IMPORTANT: do NOT show future topics to the public
  const { data: topics, error } = await supabase
    .from("topics")
    .select("id,title,starts_at,status,current_round")
    .lte("starts_at", nowIso)
    .order("starts_at", { ascending: false });

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

          {/* ✅ ALL CAPS like tournament title */}
          <div className="bb-tourTitle">PAST TOURNAMENTS</div>
        </div>

        <div className="bb-bannerRight">
          <Link href="/" className="bb-iconBtn" aria-label="Back to home">
            ←
          </Link>
          <div className="bb-iconBtn" aria-hidden>
            🗂️
          </div>
        </div>
      </div>

      <div className="bb-archiveWrap">
        {error ? (
          <pre className="bb-debug">
            {JSON.stringify({ error: error.message }, null, 2)}
          </pre>
        ) : null}

        {(topics ?? []).length === 0 ? (
          <div className="bb-empty">No past tournaments yet.</div>
        ) : (
          <div className="bb-archiveList">
            {(topics as TopicRow[]).map((t) => {
              const title = (t.title ?? "").toUpperCase();
              const started = formatDate(t.starts_at);
              const isActive = t.status === "active";

              return (
                <Link key={t.id} href={`/archive/${t.id}`} className="bb-archiveBubbleLink">
                  <div className="bb-archiveBubble">
                    <div className="bb-archiveBubbleLeft">
                      <div className="bb-archiveBubbleKicker">TOURNAMENT</div>
                      <div className="bb-archiveBubbleTitle">{title}</div>
                      <div className="bb-archiveBubbleMeta">Started {started}</div>
                    </div>

                    <div className="bb-archiveBubbleRight">
                      {isActive ? (
                        <span className="bb-archivePill">ACTIVE</span>
                      ) : (
                        <span className="bb-archivePill bb-archivePillMuted">VIEW</span>
                      )}
                      <span className="bb-archiveArrow">→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
