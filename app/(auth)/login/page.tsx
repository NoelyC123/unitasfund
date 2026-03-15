"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/db/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ type: "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({ type: "error", text: error.message });
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="rounded-xl p-8 shadow-lg"
      style={{ backgroundColor: "#ffffff", border: "1px solid #ece6dd" }}
    >
      <h1 className="text-2xl font-bold mb-2" style={{ color: "#1a1f2e" }}>
        Log in
      </h1>
      <p className="text-sm mb-6" style={{ color: "#4a5568" }}>
        UnitasFund — Funding · Strategy · Growth
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: "#1a1f2e" }}>
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
            style={{ borderColor: "#ece6dd", backgroundColor: "#fff", color: "#1a1f2e" }}
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: "#1a1f2e" }}>
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full px-4 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#c9923a]"
            style={{ borderColor: "#ece6dd", backgroundColor: "#fff", color: "#1a1f2e" }}
          />
        </div>
        {message && (
          <p className="text-sm text-red-600">{message.text}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-lg font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "#1a1f2e", color: "#f7f4ef" }}
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm" style={{ color: "#4a5568" }}>
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium" style={{ color: "#c9923a" }}>
          Sign up
        </Link>
      </p>
    </div>
  );
}
