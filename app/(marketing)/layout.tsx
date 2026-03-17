import Link from "next/link";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: CREAM }}>
      <header className="border-b px-6 py-4" style={{ backgroundColor: NAVY, borderColor: "#2d3345" }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-semibold" style={{ color: CREAM }}>
            UnitasFund
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm hover:underline" style={{ color: CREAM }}>
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

      <main className="max-w-4xl mx-auto px-6 py-10">{children}</main>

      <footer className="px-6 py-6 border-t" style={{ borderColor: "#2d3345", backgroundColor: NAVY }}>
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm" style={{ color: "#9ca3af" }}>
            UnitasFund — Funding · Strategy · Growth
          </span>
          <div className="flex gap-6 flex-wrap">
            <Link href="/privacy" className="text-sm hover:underline" style={{ color: "#9ca3af" }}>
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm hover:underline" style={{ color: "#9ca3af" }}>
              Terms of Service
            </Link>
            <Link href="/login" className="text-sm hover:underline" style={{ color: "#9ca3af" }}>
              Log in
            </Link>
            <Link href="/signup" className="text-sm hover:underline" style={{ color: "#9ca3af" }}>
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

