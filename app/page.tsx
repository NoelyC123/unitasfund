import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "#f7f4ef" }}
    >
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "#1a1f2e" }}>
          UnitasFund
        </h1>
        <p className="text-sm mb-8" style={{ color: "#c9923a" }}>
          Funding · Strategy · Growth
        </p>
        <p className="mb-8" style={{ color: "#1a1f2e" }}>
          UK funding intelligence platform. Sign in or create an account to get started.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="py-3 px-6 rounded-lg font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#1a1f2e", color: "#f7f4ef" }}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="py-3 px-6 rounded-lg font-semibold border-2 transition-opacity hover:opacity-90"
            style={{ borderColor: "#c9923a", color: "#1a1f2e" }}
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
