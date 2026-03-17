"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/db/browser";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (password.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    if (password !== confirm) {
      setMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage({ type: "error", text: error.message });
        return;
      }
      setMessage({ type: "success", text: "Password updated." });
      setPassword("");
      setConfirm("");
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
        Set a new password
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4 mt-6">
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: NAVY }}>
            New password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full px-4 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#c9923a]"
            style={{ borderColor: "#ece6dd", backgroundColor: "#fff", color: NAVY }}
          />
          <p className="text-xs mt-2" style={{ color: "#6b7280" }}>
            Use at least 6 characters.
          </p>
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-medium mb-1" style={{ color: NAVY }}>
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full px-4 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#c9923a]"
            style={{ borderColor: "#ece6dd", backgroundColor: "#fff", color: NAVY }}
          />
        </div>

        {message && (
          <p className={`text-sm ${message.type === "error" ? "text-red-600" : "text-green-700"}`}>
            {message.text}
            {message.type === "success" && (
              <>
                {" "}
                <Link href="/login" className="font-medium hover:underline" style={{ color: GOLD }}>
                  Log in
                </Link>
              </>
            )}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-lg font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: GOLD, color: NAVY }}
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

