import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { probeProviders } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Which AI providers are actually reachable right now.
 *
 * Administrator-only, and it reports booleans and error codes — never a key or
 * any part of one. The point is to answer "is the AI down, or is my key
 * missing, or is it just slow" without reading logs, which is otherwise
 * guesswork from the outside.
 */
export async function GET() {
  const profile = await getProfile();

  if (!profile) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (profile.role !== "admin") {
    return NextResponse.json(
      { error: "Provider health is available to administrators." },
      { status: 403 },
    );
  }

  const providers = await probeProviders();
  const healthy = providers.filter((p) => p.ok).length;

  return NextResponse.json({
    healthy,
    total: providers.length,
    degraded: healthy > 0 && healthy < providers.length,
    down: healthy === 0,
    providers,
    checkedAt: new Date().toISOString(),
  });
}
