import { getSupabaseService } from "@/lib/db/client";
import { createClient } from "@/lib/db/server";
import { NextRequest, NextResponse } from "next/server";

function normaliseFrequency(v: unknown): "daily" | "weekly" {
  return v === "daily" ? "daily" : "weekly";
}

function normaliseMinScore(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  const allowed = new Set([40, 60, 70, 80]);
  if (Number.isFinite(n) && allowed.has(n)) return n;
  return 60;
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const body = await request.json();
    const payload = {
      alerts_enabled: Boolean(body?.alerts_enabled ?? true),
      alert_frequency: normaliseFrequency(body?.alert_frequency),
      alert_min_score: normaliseMinScore(body?.alert_min_score),
    };

    const service = getSupabaseService();
    const { error } = await service.from("profiles").update(payload).eq("id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, ...payload });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

