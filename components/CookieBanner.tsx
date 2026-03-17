"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";

function getStoredConsent(): string | null {
  try {
    return window.localStorage.getItem("cookie_consent");
  } catch {
    return null;
  }
}

function setStoredConsent(v: string) {
  try {
    window.localStorage.setItem("cookie_consent", v);
  } catch {
    // ignore
  }
}

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (stored === "accepted") return;
    setShow(true);
  }, []);

  function accept() {
    setStoredConsent("accepted");
    try {
      document.cookie = `cookie_consent=accepted; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    } catch {
      // ignore
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t"
      style={{ backgroundColor: NAVY, borderColor: "#2d3345" }}
    >
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-start justify-between gap-4 flex-wrap">
        <p className="text-sm" style={{ color: CREAM, maxWidth: "48rem" }}>
          We use essential cookies for login and session management only. No tracking or advertising
          cookies.
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={accept}
            className="text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90"
            style={{ backgroundColor: GOLD, color: NAVY }}
          >
            Accept
          </button>
          <Link href="/privacy#cookies" className="text-sm hover:underline" style={{ color: "#9ca3af" }}>
            Manage
          </Link>
        </div>
      </div>
    </div>
  );
}

