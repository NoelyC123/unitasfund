import type { NextRequest } from "next/server";
import { POST as basePOST } from "@/app/api/webhooks/stripe/route";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return basePOST(request);
}

