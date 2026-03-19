"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "unitasfund_beta_banner_dismissed";

export default function BetaBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(DISMISS_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-4 px-6 py-3 text-sm"
      style={{ backgroundColor: "#fef3c7", borderBottom: "1px solid #fcd34d", color: "#92400e" }}
    >
      <p className="leading-snug">
        <strong>UnitasFund is in early beta.</strong> Data is being expanded
        daily and scores are being refined. We&apos;d love your feedback —{" "}
        <a
          href="mailto:hello@unitasconnect.com"
          className="underline font-medium hover:opacity-75"
          style={{ color: "#92400e" }}
        >
          hello@unitasconnect.com
        </a>
      </p>
      <button
        onClick={dismiss}
        aria-label="Dismiss beta notice"
        className="shrink-0 rounded p-1 hover:opacity-70 transition-opacity"
        style={{ color: "#92400e" }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4"
          aria-hidden="true"
        >
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>
  );
}
