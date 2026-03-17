"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

function IconGrid() {
  return (
    <svg width="20" height="20" style={{ flexShrink: 0 }} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconList() {
  return (
    <svg width="20" height="20" style={{ flexShrink: 0 }} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="20" height="20" style={{ flexShrink: 0 }} viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
    <svg width="20" height="20" style={{ flexShrink: 0 }} viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
    <svg width="20" height="20" style={{ flexShrink: 0 }} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="20" height="20" style={{ flexShrink: 0 }} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg width="20" height="20" style={{ flexShrink: 0 }} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 13l-7 7-11-11V2h7l11 11Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M7.5 7.5h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
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
      { href: "/pipeline", label: "Pipeline", icon: <IconList /> },
      { href: "/profile", label: "Profile", icon: <IconUser /> },
      { href: "/settings", label: "Settings", icon: <IconCog /> },
      { href: "/pricing", label: "Pricing", icon: <IconTag /> },
    ],
    []
  );

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(href);
  }

  return (
    <>
      {/* Desktop sidebar (lg+) */}
      <div
        style={{
          width: "240px",
          backgroundColor: "#1a1f2e",
          position: "fixed",
          left: 0,
          top: 0,
          height: "100vh",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
        }}
        className="hidden lg:flex"
        aria-label="Sidebar navigation"
      >
        {/* Top section */}
        <div style={{ padding: "24px" }}>
          <Link href="/dashboard" onClick={() => setMobileOpen(false)} style={{ textDecoration: "none" }}>
            <span style={{ color: "white", fontWeight: "bold", fontSize: "20px" }}>Unitas</span>
            <span style={{ color: "#c9923a", fontWeight: "bold", fontSize: "20px" }}>Fund</span>
          </Link>
        </div>

        {/* Nav section */}
        <nav style={{ flex: 1, padding: "0 12px" }}>
          {items.map((it) => {
            const active = isActive(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  textDecoration: "none",
                  marginBottom: "4px",
                  color: active ? "white" : "rgba(255,255,255,0.6)",
                  backgroundColor: active ? "rgba(255,255,255,0.1)" : "transparent",
                }}
              >
                <span style={{ flexShrink: 0 }}>{it.icon}</span>
                {it.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div style={{ padding: "16px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "12px",
              marginBottom: "8px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {props.email ?? "Signed in"}
          </p>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: "12px",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Mobile topbar */}
      <header className="lg:hidden fixed top-0 w-full h-14 z-40 bg-white border-b border-[#e8e3da] shadow-sm">
        <div className="h-full flex items-center justify-between px-4">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="p-2 rounded-lg">
            <span className="text-[#1a1f2e]">
              <IconMenu />
            </span>
          </button>
          <Link href="/dashboard" className="text-lg font-bold">
            <span className="text-[#1a1f2e]">Unitas</span>
            <span className="text-[#c9923a]">Fund</span>
          </Link>
          <div className="w-10" />
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
          <aside className="absolute left-0 top-0 h-full w-60 bg-[#1a1f2e] flex flex-col">
            <div className="p-6 flex items-center justify-between">
              <div className="text-xl font-bold">
                <span className="text-white">Unitas</span>
                <span className="text-[#c9923a]">Fund</span>
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close" className="text-white/80 hover:text-white">
                <IconX />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
              {items.map((it) => {
                const active = isActive(it.href);
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={() => setMobileOpen(false)}
                    className={[
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                      active
                        ? "bg-white/10 text-white font-medium"
                        : "text-white/60 hover:text-white hover:bg-white/5",
                    ].join(" ")}
                  >
                    <span className="shrink-0">{it.icon}</span>
                    {it.label}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-white/10">
              <span className="text-xs text-white/40 truncate block mb-2">{props.email ?? "Signed in"}</span>
              <form action="/api/auth/signout" method="post">
                <button type="submit" className="text-xs text-white/60 hover:text-white" onClick={() => setMobileOpen(false)}>
                  Sign out
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}

      {/* Main content wrapper */}
      <div style={{ marginLeft: "240px", minHeight: "100vh", backgroundColor: "#f7f4ef" }} className="lg:block">
        {/* Mobile topbar is fixed; keep padding on small screens */}
        <div className="lg:hidden" style={{ height: 56 }} />
        {props.children}
      </div>
    </>
  );
}

