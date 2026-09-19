import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { commandRequest } from "@/lib/schemas";
import { planCommand } from "@/lib/command";
import { recordAudit } from "@/lib/audit";
import { checkCommandRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The provider ladder can try three models. Vercel's default cap would kill
// the function mid-ladder, so the fallback would never actually run.
export const maxDuration = 60;

/**
 * Turns one English instruction into a proposed action.
 *
 * This endpoint never writes to an academic table. A read is answered directly;
 * a write comes back as a preview the user has to confirm at
 * /api/ai/command/execute. The command itself is recorded in the audit trail
 * either way, so "what did anyone ask the AI to do" is answerable after the fact.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const profile = await getProfile();

  if (!profile) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // The command bar is an administrative tool. A student has no instruction it
  // could usefully run, and every write path would be denied anyway.
  if (profile.role === "student") {
    return NextResponse.json(
      { error: "The command bar is available to teachers and administrators." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = commandRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Say what you would like to do." },
      { status: 400 },
    );
  }

  const limit = await checkCommandRateLimit(supabase, profile.id);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: limit.message },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const { utterance } = parsed.data;
  const outcome = await planCommand(supabase, profile, utterance);

  await recordAudit(supabase, profile, {
    action: outcome.kind === "confirm" ? "ai_command.preview" : "ai_command.query",
    entity: "ai_command",
    summary:
      outcome.kind === "confirm"
        ? `Previewed a change from: “${utterance}”`
        : `Asked: “${utterance}”`,
    detail: { utterance, outcome: outcome.kind },
    source: "ai_command",
  });

  if (outcome.kind === "error") {
    return NextResponse.json({ error: outcome.message }, { status: 422 });
  }

  return NextResponse.json(outcome);
}
