import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { confirmWrite } from "@/lib/schemas";
import { executeMarkUpdate } from "@/lib/command";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Applies a change the user confirmed in the preview.
 *
 * Separated from the planning endpoint on purpose: this route calls no language
 * model at all. By the time a request arrives here the instruction has already
 * been reduced to three concrete values, so the model cannot influence what is
 * written. The confirmation from the browser is a request, not authorisation —
 * the role check, the mark ceiling and RLS are all re-applied here.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const profile = await getProfile();

  if (!profile) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (profile.role === "student") {
    return NextResponse.json(
      { error: "Students cannot change academic records." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = confirmWrite.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "That change is not valid." },
      { status: 400 },
    );
  }

  const { studentId, assessmentId, newScore, utterance } = parsed.data;

  const result = await executeMarkUpdate(supabase, profile, {
    studentId,
    assessmentId,
    newScore,
  });

  await recordAudit(supabase, profile, {
    action: result.ok ? "ai_command.execute" : "ai_command.rejected",
    entity: "edu_scores",
    entityId: assessmentId,
    summary: result.ok
      ? `${result.message} Requested by: “${utterance}”`
      : `Rejected “${utterance}” — ${result.message}`,
    detail: { utterance, ...(result.detail ?? {}) },
    source: "ai_command",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 422 });
  }

  return NextResponse.json({ ok: true, message: result.message });
}
