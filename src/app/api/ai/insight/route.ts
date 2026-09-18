import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildStudentReport } from "@/lib/academics";
import { generateInsight } from "@/lib/ai";
import { insightRequest } from "@/lib/schemas";
import { checkAiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = insightRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "A valid studentId is required." },
      { status: 400 },
    );
  }
  const { studentId } = parsed.data;

  const limit = await checkAiRateLimit(supabase, user.id);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: limit.message },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  // RLS decides visibility: a student sees only themselves, a teacher only the
  // students they actually teach. An unauthorised id simply yields nothing.
  const report = await buildStudentReport(supabase, studentId);
  if (!report) {
    return NextResponse.json(
      { error: "That student record is not available to you." },
      { status: 404 },
    );
  }

  const { data: previous } = await supabase
    .from("edu_ai_insights")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Debounce: a double-clicked button must not burn two generations.
  if (previous && Date.now() - new Date(previous.created_at).getTime() < 8000) {
    return NextResponse.json({ insight: previous, reused: true });
  }

  const hasData =
    report.overallScorePct !== null || report.overallAttendancePct !== null;

  if (!hasData) {
    return NextResponse.json(
      {
        error:
          "There is no graded work or attendance on record for this student yet, so there is nothing to analyse.",
      },
      { status: 422 },
    );
  }

  const { insight, errors } = await generateInsight(report);

  if (!insight) {
    if (previous) {
      return NextResponse.json({
        insight: previous,
        stale: true,
        error: "AI providers are unavailable right now — showing the last saved analysis.",
      });
    }
    return NextResponse.json(
      {
        error:
          "The AI service is unavailable right now. Please try again in a moment.",
        detail: errors.join("; "),
      },
      { status: 503 },
    );
  }

  const { data: saved, error: saveError } = await supabase
    .from("edu_ai_insights")
    .insert({
      student_id: studentId,
      risk_level: insight.risk_level,
      summary: insight.summary,
      trend: insight.trend,
      weak_subjects: insight.weak_subjects,
      recommendations: insight.recommendations,
      model: insight.model,
      generated_by: user.id,
    })
    .select("*")
    .single();

  if (saveError) {
    // The analysis is still valid even if persistence failed — show it.
    return NextResponse.json({
      insight: { ...insight, id: "unsaved", student_id: studentId, created_at: new Date().toISOString() },
      unsaved: true,
    });
  }

  return NextResponse.json({ insight: saved });
}
