"use client";

import { useRouter } from "next/navigation";

const GOLD = "#c9923a";

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="text-sm hover:underline"
      style={{ color: GOLD }}
    >
      ← Back to dashboard
    </button>
  );
}

