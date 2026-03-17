import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { redirect } from "next/navigation";
import StatsSection from "./StatsSection";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: CREAM }}>
      {/* Header */}
      <header
        className="border-b px-6 py-4"
        style={{ backgroundColor: NAVY, borderColor: "#2d3345" }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="font-semibold" style={{ color: CREAM }}>
            UnitasFund
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm hover:underline"
              style={{ color: CREAM }}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: GOLD, color: NAVY }}
            >
              Sign up free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-20 text-center max-w-3xl mx-auto">
        <h1
          className="text-4xl sm:text-5xl font-bold mb-4 leading-tight"
          style={{ color: NAVY }}
        >
          Find the right funding. Apply with confidence.
        </h1>
        <p
          className="text-xl sm:text-2xl mb-10 leading-relaxed"
          style={{ color: "#4a5568" }}
        >
          UnitasFund matches your organisation to grants you can actually win —
          scored, ranked and explained.
        </p>
        <Link
          href="/signup"
          className="inline-block px-8 py-4 rounded-lg text-lg font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: GOLD, color: NAVY }}
        >
          Sign up free
        </Link>
      </section>

      {/* How it works */}
      <section
        className="px-6 py-16 border-t"
        style={{ borderColor: "#ece6dd", backgroundColor: "#fff" }}
      >
        <div className="max-w-4xl mx-auto">
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-2"
            style={{ color: GOLD }}
          >
            How it works
          </p>
          <h2 className="text-2xl font-bold mb-12" style={{ color: NAVY }}>
            Three steps to better funding
          </h2>
          <div className="grid sm:grid-cols-3 gap-10">
            <div>
              <span
                className="inline-flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg mb-4"
                style={{ backgroundColor: "#ece6dd", color: GOLD }}
              >
                1
              </span>
              <h3 className="font-semibold text-lg mb-2" style={{ color: NAVY }}>
                Create profile
              </h3>
              <p className="text-sm" style={{ color: "#4a5568" }}>
                Tell us your organisation type, region, income band and sectors.
                We use this to match you to the right grants.
              </p>
            </div>
            <div>
              <span
                className="inline-flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg mb-4"
                style={{ backgroundColor: "#ece6dd", color: GOLD }}
              >
                2
              </span>
              <h3 className="font-semibold text-lg mb-2" style={{ color: NAVY }}>
                Get matched
              </h3>
              <p className="text-sm" style={{ color: "#4a5568" }}>
                See opportunities ranked by fit score and expected value. Each
                match is explained so you know why it fits.
              </p>
            </div>
            <div>
              <span
                className="inline-flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg mb-4"
                style={{ backgroundColor: "#ece6dd", color: GOLD }}
              >
                3
              </span>
              <h3 className="font-semibold text-lg mb-2" style={{ color: NAVY }}>
                Apply with confidence
              </h3>
              <p className="text-sm" style={{ color: "#4a5568" }}>
                Track applications in your pipeline. Focus on the grants most
                worth your time.
              </p>
            </div>
          </div>
        </div>
      </section>

      <StatsSection />

      {/* Key features */}
      <section className="px-6 py-16" style={{ backgroundColor: "#faf8f5" }}>
        <div className="max-w-4xl mx-auto">
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-2"
            style={{ color: GOLD }}
          >
            Key features
          </p>
          <h2 className="text-2xl font-bold mb-12" style={{ color: NAVY }}>
            Built for organisations that chase grants
          </h2>
          <div className="grid sm:grid-cols-2 gap-8">
            <div
              className="rounded-xl p-6 border"
              style={{
                backgroundColor: "#fff",
                borderColor: "#ece6dd",
              }}
            >
              <h3 className="font-semibold text-lg mb-2" style={{ color: NAVY }}>
                AI fit scoring
              </h3>
              <p className="text-sm" style={{ color: "#4a5568" }}>
                Every opportunity is scored on location, sector, income and
                deadline. See exactly why a grant fits — or doesn’t.
              </p>
            </div>
            <div
              className="rounded-xl p-6 border"
              style={{
                backgroundColor: "#fff",
                borderColor: "#ece6dd",
              }}
            >
              <h3 className="font-semibold text-lg mb-2" style={{ color: NAVY }}>
                Expected value engine
              </h3>
              <p className="text-sm" style={{ color: "#4a5568" }}>
                Win probability × award value − bid cost. We surface grants that
                are worth your effort, not just eligible.
              </p>
            </div>
            <div
              className="rounded-xl p-6 border"
              style={{
                backgroundColor: "#fff",
                borderColor: "#ece6dd",
              }}
            >
              <h3 className="font-semibold text-lg mb-2" style={{ color: NAVY }}>
                Pipeline tracker
              </h3>
              <p className="text-sm" style={{ color: "#4a5568" }}>
                Add opportunities to your pipeline and track status from
                interested to submitted, won or lost.
              </p>
            </div>
            <div
              className="rounded-xl p-6 border"
              style={{
                backgroundColor: "#fff",
                borderColor: "#ece6dd",
              }}
            >
              <h3 className="font-semibold text-lg mb-2" style={{ color: NAVY }}>
                Award intelligence
              </h3>
              <p className="text-sm" style={{ color: "#4a5568" }}>
                Grant data from 360Giving and other sources helps rank and
                explain what’s actually being funded.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof + CTA */}
      <section
        className="px-6 py-20 border-t text-center"
        style={{ borderColor: "#ece6dd", backgroundColor: NAVY }}
      >
        <div className="max-w-2xl mx-auto">
          <p
            className="text-lg font-medium mb-6"
            style={{ color: CREAM }}
          >
            Join organisations already finding better funding
          </p>
          <Link
            href="/signup"
            className="inline-block px-8 py-4 rounded-lg text-lg font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: GOLD, color: NAVY }}
          >
            Sign up free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="px-6 py-6 border-t"
        style={{ borderColor: "#2d3345", backgroundColor: NAVY }}
      >
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm" style={{ color: "#9ca3af" }}>
            UnitasFund — Funding · Strategy · Growth
          </span>
          <div className="flex gap-6 flex-wrap">
            <Link
              href="/privacy"
              className="text-sm hover:underline"
              style={{ color: "#9ca3af" }}
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-sm hover:underline"
              style={{ color: "#9ca3af" }}
            >
              Terms of Service
            </Link>
            <Link
              href="/login"
              className="text-sm hover:underline"
              style={{ color: "#9ca3af" }}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm hover:underline"
              style={{ color: "#9ca3af" }}
            >
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
