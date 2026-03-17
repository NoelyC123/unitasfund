/**
 * Send email alerts for new high-fit opportunities.
 *
 * Usage:
 *   npm run alerts -- --dry-run
 *   npm run alerts -- --user someone@example.com
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { getSupabaseService } from "../../lib/db/client";

type Flags = {
  dryRun: boolean;
  userEmail: string | null;
};

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function getStringFlag(name: string): string | null {
  const idx = process.argv.findIndex((a) => a === name);
  if (idx === -1) return null;
  const v = process.argv[idx + 1];
  return v && !v.startsWith("--") ? v : null;
}

function getFlags(): Flags {
  return {
    dryRun: hasFlag("--dry-run"),
    userEmail: getStringFlag("--user"),
  };
}

function daysForFrequency(freq: string): number {
  return freq === "daily" ? 1 : 7;
}

function formatDeadline(d: string | null): string {
  if (!d || !d.trim()) return "Rolling";
  const date = new Date(d.trim());
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

async function sendResendEmail(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is required.");

  const from = process.env.RESEND_FROM ?? "UnitasFund <alerts@unitasfund.vercel.app>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend API ${res.status}: ${t}`);
  }
}

async function main() {
  const flags = getFlags();
  const supabase = getSupabaseService();

  // Get profiles with alerts enabled.
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, alerts_enabled, alert_min_score, alert_frequency")
    .eq("alerts_enabled", true);

  if (profileError) {
    console.error("Failed to fetch profiles:", profileError.message);
    process.exit(1);
  }

  let targets = (profiles ?? []) as Array<{
    id: string;
    alerts_enabled: boolean;
    alert_min_score: number;
    alert_frequency: string;
  }>;

  // If --user is set, resolve by email via Supabase auth admin.
  if (flags.userEmail) {
    const email = flags.userEmail.trim().toLowerCase();
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) {
      console.error("Failed to list users:", usersError.message);
      process.exit(1);
    }
    const user = users.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (!user) {
      console.error("No user found with email:", flags.userEmail);
      process.exit(1);
    }
    targets = targets.filter((p) => p.id === user.id);
  }

  const baseUrl = process.env.SITE_URL ?? "https://unitasfund.vercel.app";

  let emailsSent = 0;
  let alertsInserted = 0;

  for (const p of targets) {
    const userId = p.id;
    const minScore = Number(p.alert_min_score ?? 60);
    const frequency = String(p.alert_frequency ?? "weekly");
    const days = daysForFrequency(frequency);
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Resolve user email.
    const { data: userRes, error: userErr } = await supabase.auth.admin.getUserById(userId);
    if (userErr || !userRes.user?.email) {
      console.warn("Skipping user (no email):", userId);
      continue;
    }
    const toEmail = userRes.user.email;

    // Org link.
    const { data: link, error: linkErr } = await supabase
      .from("user_organisations")
      .select("organisation_id")
      .eq("user_id", userId)
      .limit(1)
      .single();
    if (linkErr || !link?.organisation_id) {
      console.warn("Skipping user (no organisation):", toEmail);
      continue;
    }
    const orgId = link.organisation_id as string;

    // Candidate matches: scores >= minScore and opportunities created recently.
    const { data: scoreRows, error: scoreErr } = await supabase
      .from("scores")
      .select(
        `
        opportunity_id,
        fit_score,
        opportunities!inner (
          id,
          title,
          funder_name,
          deadline,
          first_seen_at,
          is_active
        )
      `
      )
      .eq("organisation_id", orgId)
      .gte("fit_score", minScore)
      .eq("opportunities.is_active", true)
      .gte("opportunities.first_seen_at", sinceIso)
      .order("fit_score", { ascending: false })
      .limit(50);

    if (scoreErr) {
      console.warn("Score query failed for", toEmail, ":", scoreErr.message);
      continue;
    }

    const matches = (scoreRows ?? []).map((r: any) => ({
      opportunity_id: r.opportunity_id as string,
      fit_score: Number(r.fit_score ?? 0),
      title: r.opportunities?.title as string,
      funder_name: (r.opportunities?.funder_name as string | null) ?? null,
      deadline: (r.opportunities?.deadline as string | null) ?? null,
    }));

    if (matches.length === 0) continue;

    // Filter already-sent.
    const oppIds = matches.map((m) => m.opportunity_id);
    const { data: sentRows, error: sentErr } = await supabase
      .from("alerts")
      .select("opportunity_id")
      .eq("user_id", userId)
      .eq("alert_type", "new_match")
      .in("opportunity_id", oppIds);

    if (sentErr) {
      console.warn("Alerts query failed for", toEmail, ":", sentErr.message);
      continue;
    }
    const sentSet = new Set((sentRows ?? []).map((s: any) => String(s.opportunity_id)));
    const fresh = matches.filter((m) => !sentSet.has(m.opportunity_id));

    if (fresh.length === 0) continue;

    const subject = `You have ${fresh.length} new funding matches on UnitasFund`;

    const itemsHtml = fresh
      .map((m) => {
        const href = `${baseUrl}/opportunity/${m.opportunity_id}`;
        const score = Math.round(m.fit_score);
        return `<li style="margin: 0 0 10px 0;">
          <div><a href="${href}"><strong>${m.title}</strong></a></div>
          <div style="color:#4a5568;font-size:13px;">${m.funder_name ?? "—"} · ${score}% fit · Deadline: ${formatDeadline(m.deadline)}</div>
        </li>`;
      })
      .join("");

    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
        <h2 style="color:#1a1f2e;">${subject}</h2>
        <p style="color:#4a5568;">Here are your latest matches:</p>
        <ul style="padding-left:18px;">${itemsHtml}</ul>
        <hr style="border:none;border-top:1px solid #ece6dd;margin:20px 0;" />
        <p style="color:#6b7280;font-size:12px;">Manage your alert preferences at ${baseUrl}/settings</p>
      </div>
    `;

    if (flags.dryRun) {
      console.log("[dry-run] Would email:", toEmail, "subject:", subject, "items:", fresh.length);
    } else {
      await sendResendEmail({ to: toEmail, subject, html });
      emailsSent += 1;

      const now = new Date().toISOString();
      const inserts = fresh.map((m) => ({
        user_id: userId,
        org_id: orgId,
        opportunity_id: m.opportunity_id,
        alert_type: "new_match",
        sent_at: now,
      }));

      const { error: insErr } = await supabase.from("alerts").insert(inserts);
      if (insErr) {
        console.warn("Failed inserting alerts rows for", toEmail, ":", insErr.message);
      } else {
        alertsInserted += inserts.length;
      }
    }
  }

  console.log("Done.");
  console.log("Emails sent:", emailsSent);
  console.log("Alerts inserted:", alertsInserted);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

