"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";
const MUTED = "#6b7280";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconKanban() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 5h4v14H5V5Zm10 0h4v10h-4V5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M3 5h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 21a8 8 0 1 0-16 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconCog() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 15a7.9 7.9 0 0 0 .1-6l-2.1.3a6.2 6.2 0 0 0-1.6-1.6l.3-2.1a7.9 7.9 0 0 0-6-.1l.3 2.1a6.2 6.2 0 0 0-1.6 1.6L6.5 9a7.9 7.9 0 0 0-.1 6l2.1-.3a6.2 6.2 0 0 0 1.6 1.6l-.3 2.1a7.9 7.9 0 0 0 6 .1l-.3-2.1a6.2 6.2 0 0 0 1.6-1.6l2.3.3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function DashboardShell(props: {
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items: NavItem[] = useMemo(
    () => [
      { href: "/dashboard", label: "Dashboard", icon: <IconGrid /> },
      { href: "/pipeline", label: "Pipeline", icon: <IconKanban /> },
      { href: "/profile", label: "Profile", icon: <IconUser /> },
      { href: "/settings", label: "Settings", icon: <IconCog /> },
    ],
    []
  );

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(href);
  }

  const Sidebar = (
    <aside
      className="h-full w-[240px] flex flex-col"
      style={{ backgroundColor: NAVY }}
      aria-label="Sidebar navigation"
    >
      <div className="px-5 py-5 border-b" style={{ borderColor: "#2d3345" }}>
        <Link href="/dashboard" className="text-lg font-bold tracking-tight" onClick={() => setMobileOpen(false)}>
          <span style={{ color: "#ffffff" }}>Unitas</span>
          <span style={{ color: GOLD }}>Fund</span>
        </Link>
      </div>

      <nav className="px-3 py-4 space-y-1">
        {items.map((it) => {
          const active = isActive(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => setMobileOpen(false)}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
              style={{
                color: active ? GOLD : "rgba(255,255,255,0.7)",
                backgroundColor: active ? "rgba(201,146,58,0.08)" : "transparent",
                borderLeft: active ? `3px solid ${GOLD}` : "3px solid transparent",
              }}
            >
              <span className="shrink-0">{it.icon}</span>
              <span className="text-sm font-semibold">{it.label}</span>
              <span
                className="ml-auto h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: active ? GOLD : "transparent" }}
              />
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-5 py-5 border-t" style={{ borderColor: "#2d3345" }}>
        <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
          {props.email ?? "Signed in"}
        </div>
        <form action="/api/auth/signout" method="post" className="mt-2">
          <button type="submit" className="text-sm font-semibold hover:underline" style={{ color: GOLD }}>
            Sign out
          </button>
        </form>
        <div className="mt-3 flex gap-4 flex-wrap">
          <Link href="/privacy" className="text-xs hover:underline" style={{ color: "rgba(255,255,255,0.55)" }}>
            Privacy
          </Link>
          <Link href="/terms" className="text-xs hover:underline" style={{ color: "rgba(255,255,255,0.55)" }}>
            Terms
          </Link>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: CREAM }}>
      {/* Desktop sidebar */}
      <div className="hidden md:fixed md:inset-y-0 md:left-0 md:block md:w-[240px]">{Sidebar}</div>

      {/* Mobile topbar */}
      <header className="md:hidden border-b" style={{ borderColor: "#e8e3da", backgroundColor: "#ffffff" }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg border"
            style={{ borderColor: "#e8e3da", color: NAVY, backgroundColor: "#ffffff" }}
            aria-label="Open navigation"
          >
            <IconMenu />
          </button>
          <Link href="/dashboard" className="font-bold">
            <span style={{ color: NAVY }}>Unitas</span>
            <span style={{ color: GOLD }}>Fund</span>
          </Link>
          <div className="w-10" />
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
          <div className="absolute inset-y-0 left-0 w-[280px]">
            <div className="flex items-center justify-between px-4 py-4 border-b" style={{ backgroundColor: NAVY, borderColor: "#2d3345" }}>
              <div className="font-bold">
                <span style={{ color: "#ffffff" }}>Unitas</span>
                <span style={{ color: GOLD }}>Fund</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg"
                style={{ color: "#ffffff" }}
                aria-label="Close"
              >
                <IconX />
              </button>
            </div>
            {Sidebar}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="md:ml-[240px]" style={{ backgroundColor: CREAM }}>
        <div className="max-w-5xl mx-auto px-6 py-8" style={{ color: MUTED }}>
          {props.children}
        </div>
      </div>
    </div>
  );
}

