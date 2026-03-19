import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import BetaBanner from "@/components/BetaBanner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f7f4ef" }}>
      <header
        className="border-b px-6 py-4"
        style={{ backgroundColor: "#1a1f2e", borderColor: "#2d3345" }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold" style={{ color: "#f7f4ef" }}>
              UnitasFund
            </span>
            <nav className="flex items-center gap-4">
              <a
                href="/dashboard"
                className="text-sm hover:underline"
                style={{ color: "#f7f4ef" }}
              >
                Dashboard
              </a>
              <a
                href="/pipeline"
                className="text-sm hover:underline"
                style={{ color: "#f7f4ef" }}
              >
                Pipeline
              </a>
            </nav>
          </div>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm hover:underline"
              style={{ color: "#c9923a" }}
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <BetaBanner />

      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
