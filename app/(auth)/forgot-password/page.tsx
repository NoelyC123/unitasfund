"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/db/browser";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://unitasfund.vercel.app/reset-password",
      });
      if (error) {
        setMessage({ type: "error", text: error.message });
        return;
      }
      setMessage({ type: "success", text: "Check your email for a reset link." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="rounded-xl p-8 shadow-lg"
      style={{ backgroundColor: "#ffffff", border: "1px solid #ece6dd" }}
    >
      <h1 className="text-2xl font-bold mb-2" style={{ color: NAVY }}>
        Reset your password
      </h1>
      <p className="text-sm mb-6" style={{ color: "#4a5568" }}>
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: NAVY }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full px-4 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#c9923a]"
            style={{ borderColor: "#ece6dd", backgroundColor: "#fff", color: NAVY }}
          />
        </div>

        {message && (
          <p className={`text-sm ${message.type === "error" ? "text-red-600" : "text-green-700"}`}>
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-lg font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: GOLD, color: NAVY }}
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: "#4a5568" }}>
        <Link href="/login" className="font-medium" style={{ color: GOLD }}>
          Back to log in
        </Link>
      </p>
    </div>
  );
}

