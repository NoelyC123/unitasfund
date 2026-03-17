"use client";

import { useState } from "react";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";

export default function AddToPipelineButton({
  opportunityId,
  initiallyAdded = false,
}: {
  opportunityId: string;
  initiallyAdded?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(initiallyAdded);

  async function addToPipeline() {
    setAdding(true);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity_id: opportunityId }),
      });
      if (res.ok) setAdded(true);
    } finally {
      setAdding(false);
    }
  }

  return (
    <button
      type="button"
      onClick={addToPipeline}
      disabled={adding || added}
      className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60"
      style={{
        backgroundColor: added ? "#22c55e" : GOLD,
        color: added ? CREAM : NAVY,
      }}
    >
      {added ? "In pipeline" : adding ? "Adding…" : "Add to pipeline"}
    </button>
  );
}

