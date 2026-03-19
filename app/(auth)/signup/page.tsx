"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/db/browser";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage({ type: "error", text: error.message });
        return;
      }
      setMessage({
        type: "success",
        text: "Check your email for the confirmation link.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: CREAM }}>
      <div className="max-w-7xl mx-auto px-6 py-10">
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <span className="font-semibold text-lg" style={{ color: NAVY }}>
            Unitas<span style={{ color: GOLD }}>Fund</span>
          </span>
        </Link>

        <div
          className="w-full grid grid-cols-1 lg:grid-cols-2 rounded-2xl border overflow-hidden"
          style={{ borderColor: "#ece6dd", backgroundColor: "#fff" }}
        >
          {/* Left panel */}
          <div className="p-8 lg:p-10" style={{ backgroundColor: NAVY }}>
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: GOLD }}>
              Get started
            </p>
            <h1 className="text-3xl font-bold mt-3 leading-tight" style={{ color: CREAM }}>
              Find grants you can actually win — scored and ranked for your organisation
            </h1>
            <p className="text-sm mt-4" style={{ color: "#a8b4c4" }}>
              Create a profile once, then browse opportunities with clear fit reasons and a pipeline
              to track applications.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: "Explainable fit", text: "Location, sector, income and deadline — broken down clearly." },
                { title: "Worth your time", text: "Expected value helps prioritise effort." },
                { title: "Pipeline tracker", text: "Track from interested to submitted and won." },
                { title: "Local focus", text: "Cumbria & Lancashire first, UK-wide where relevant." },
              ].map((b) => (
                <div
                  key={b.title}
                  className="rounded-xl border p-4"
                  style={{ borderColor: "#2d3345", backgroundColor: "#252c3f" }}
                >
                  <p className="text-sm font-semibold" style={{ color: CREAM }}>
                    {b.title}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#a8b4c4" }}>
                    {b.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right panel form */}
          <div className="p-8 lg:p-10">
            <h2 className="text-2xl font-bold" style={{ color: NAVY }}>
              Create your account
            </h2>
            <p className="text-sm mt-2" style={{ color: "#4a5568" }}>
              Free to get started. You can set up your organisation profile after signing up.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
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
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: NAVY }}>
                  Password
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
                {loading ? "Signing up…" : "Sign up"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm" style={{ color: "#4a5568" }}>
              Already have an account?{" "}
              <Link href="/login" className="font-medium" style={{ color: GOLD }}>
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
