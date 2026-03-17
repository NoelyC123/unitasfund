"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";

type Stat = { value: number; suffix?: string; label: string };

function useInViewOnce<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, inView };
}

function CountUp({
  target,
  suffix,
  start,
}: {
  target: number;
  suffix?: string;
  start: boolean;
}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const durationMs = 900;
    const t0 = performance.now();

    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, target]);

  return (
    <span className="tabular-nums">
      {value}
      {suffix ?? ""}
    </span>
  );
}

export default function StatsSection() {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();

  const stats = useMemo<Stat[]>(
    () => [
      { value: 17, suffix: "+", label: "funding opportunities tracked" },
      { value: 10, suffix: "+", label: "sources scraped daily" },
      { value: 0, label: "Free to get started" },
      { value: 0, label: "Cumbria & Lancashire focused" },
    ],
    []
  );

  return (
    <section
      ref={ref}
      className="px-6 py-16 border-t"
      style={{ backgroundColor: NAVY, borderColor: "#2d3345" }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end justify-between gap-6 flex-wrap mb-10">
          <div>
            <p
              className="text-xs font-semibold tracking-widest uppercase mb-2"
              style={{ color: GOLD }}
            >
              At a glance
            </p>
            <h2 className="text-2xl font-bold" style={{ color: CREAM }}>
              Built for real-world funding work
            </h2>
          </div>
          <p className="text-sm max-w-md" style={{ color: "#a8b4c4" }}>
            A quick snapshot of what UnitasFund is tracking right now.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border p-5"
              style={{ borderColor: "#2d3345", backgroundColor: "#252c3f" }}
            >
              <div className="text-3xl font-bold" style={{ color: GOLD }}>
                {s.value > 0 ? (
                  <CountUp target={s.value} suffix={s.suffix} start={inView} />
                ) : (
                  <span>—</span>
                )}
              </div>
              <p className="mt-2 text-sm" style={{ color: CREAM }}>
                {s.label}
              </p>
              {s.value === 0 && (
                <p className="mt-1 text-xs" style={{ color: "#a8b4c4" }}>
                  Included on the free plan.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

