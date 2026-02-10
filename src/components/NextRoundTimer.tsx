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

  // ✅ allow recomputing target after a round flips
  const [tickKey, setTickKey] = useState(0);

  const target = useMemo(() => getNextRoundChangeET(), [tickKey]);
  const [mounted, setMounted] = useState(false);
  const [msLeft, setMsLeft] = useState<number>(0);

  useEffect(() => {
    setMounted(true);

    const tick = () => {
      const left = target.toMillis() - Date.now();
      setMsLeft(left);

      if (left <= 0) {
        // refresh server data AND recompute next deadline
        router.refresh();
        setTickKey((k) => k + 1);
      }
    };

    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [router, target]);

  if (!mounted) {
    return (
      <div className="text-sm opacity-80">
        Next round in: <span className="font-semibold">--</span>
      </div>
    );
  }

  return (
    <div className="text-sm opacity-80">
      Next round in: <span className="font-semibold">{format(msLeft)}</span>
    </div>
  );
}
