import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";

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
              <a
                href="/profile"
                className="text-sm hover:underline"
                style={{ color: "#f7f4ef" }}
              >
                Profile
              </a>
              <a
                href="/settings"
                className="text-sm hover:underline"
                style={{ color: "#f7f4ef" }}
              >
                Settings
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
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
      <footer
        className="mt-10 px-6 py-6 border-t"
        style={{ borderColor: "#ece6dd", backgroundColor: "#f7f4ef" }}
      >
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm" style={{ color: "#6b7280" }}>
            UnitasFund
          </span>
          <div className="flex gap-6 flex-wrap">
            <a href="/privacy" className="text-sm hover:underline" style={{ color: "#6b7280" }}>
              Privacy Policy
            </a>
            <a href="/terms" className="text-sm hover:underline" style={{ color: "#6b7280" }}>
              Terms of Service
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
