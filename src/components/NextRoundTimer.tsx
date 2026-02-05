"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getNextRoundChangeET } from "@/lib/schedule";

function format(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}h ${m}m ${s}s`;
}

export default function NextRoundTimer() {
  const router = useRouter();

  // compute the next deadline once (we will refresh when it passes)
  const target = useMemo(() => getNextRoundChangeET(), []);

  const [msLeft, setMsLeft] = useState(() => target.toMillis() - Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      const left = target.toMillis() - Date.now();
      setMsLeft(left);

      // when it hits 0, refresh the page so it can load the new round/topic
      if (left <= 0) {
        router.refresh();
      }
    }, 250);

    return () => clearInterval(t);
  }, [router, target]);

  return (
    <div className="text-sm opacity-80">
      Next update in: <span className="font-semibold">{format(msLeft)}</span>
    </div>
  );
}
