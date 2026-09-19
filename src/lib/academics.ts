import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseReport, StudentReport } from "./types";

/**
 * Grade rules, stated once so the UI and the AI prompt agree:
 *  - "graded"  -> counts, score over max_score
 *  - "missing" -> counts as 0 out of max_score (a skipped assessment hurts)
 *  - "pending" / "submitted" -> excluded entirely; not yet evaluated
 * Attendance: present = 1, late = 0.5, absent = 0.
 * Any denominator of zero yields null, never NaN.
 */
const COUNTED = new Set(["graded", "missing"]);

function pct(numerator: number, denominator: number): number | null {
  if (!denominator || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

type Row = Record<string, unknown>;

/**
 * PostgREST returns an embedded to-one relation as either an object or a
 * single-element array depending on how it infers the relationship. Normalise
 * both shapes to one row.
 */
function one(value: unknown): Row {
  if (Array.isArray(value)) return (value[0] ?? {}) as Row;
  return (value ?? {}) as Row;
}

/**
 * Builds the full academic rollup for one student. Every query is RLS-scoped,
 * so this returns nothing at all if the caller may not see this student.
 */
export async function buildStudentReport(
  supabase: SupabaseClient,
  studentId: string,
): Promise<StudentReport | null> {
  const { data: student } = await supabase
    .from("edu_students")
    .select("id, roll_no, class_name, profile_id, edu_profiles(full_name)")
    .eq("id", studentId)
    .maybeSingle();

  if (!student) return null;

  const [{ data: enrollments }, { data: scores }, { data: attendance }] =
    await Promise.all([
      supabase
        .from("edu_enrollments")
        .select(
          "course_id, edu_courses(id, code, title, credits, schedule, edu_teachers(full_name))",
        )
        .eq("student_id", studentId),
      supabase
        .from("edu_scores")
        .select("score, status, edu_assessments(id, course_id, max_score, title, kind)")
        .eq("student_id", studentId),
      supabase
        .from("edu_attendance")
        .select("course_id, status")
        .eq("student_id", studentId),
    ]);

  const courses: CourseReport[] = (enrollments ?? []).map((e: Row) => {
    const c = one(e.edu_courses);
    const teacher = one(c.edu_teachers);
    const courseId = String(e.course_id);

    const mine = (scores ?? []).filter(
      (s: Row) => String(one(s.edu_assessments).course_id) === courseId,
    );
    let earned = 0;
    let possible = 0;
    let graded = 0;
    let pending = 0;
    let pendingMax = 0;
    let missing = 0;
    for (const s of mine as Row[]) {
      const a = one(s.edu_assessments);
      const max = Number(a.max_score ?? 0);
      if (s.status === "graded") {
        earned += Number(s.score ?? 0);
        possible += max;
        graded += 1;
      } else if (s.status === "missing") {
        possible += max;
        missing += 1;
      } else {
        pending += 1;
        pendingMax += max;
      }
    }

    const att = (attendance ?? []).filter((a: Row) => String(a.course_id) === courseId);
    const present = att.filter((a: Row) => a.status === "present").length;
    const late = att.filter((a: Row) => a.status === "late").length;
    const absent = att.filter((a: Row) => a.status === "absent").length;
    const sessions = att.length;

    return {
      courseId,
      code: String(c.code ?? "—"),
      title: String(c.title ?? "Untitled course"),
      credits: Number(c.credits ?? 0),
      schedule: String(c.schedule ?? "TBD"),
      teacher: String(teacher.full_name ?? "Unassigned"),
      scorePct: pct(earned, possible),
      earned,
      possible,
      graded,
      pending,
      pendingMax,
      missing,
      attendancePct: pct(present + late * 0.5, sessions),
      present,
      late,
      absent,
      sessions,
    };
  });

  courses.sort((a, b) => a.code.localeCompare(b.code));

  const totalEarned = courses.reduce((n, c) => n + c.earned, 0);
  const totalPossible = courses.reduce((n, c) => n + c.possible, 0);
  const totalWeighted = courses.reduce((n, c) => n + c.present + c.late * 0.5, 0);
  const totalSessions = courses.reduce((n, c) => n + c.sessions, 0);

  const profile = one(student.edu_profiles);

  return {
    studentId,
    name: String(profile.full_name ?? "Student"),
    rollNo: String(student.roll_no ?? "—"),
    className: String(student.class_name ?? "—"),
    courses,
    overallScorePct: pct(totalEarned, totalPossible),
    overallAttendancePct: pct(totalWeighted, totalSessions),
  };
}

/** Cheap class-wide rollup used by the teacher and admin overviews. */
export async function buildCohortSummary(
  supabase: SupabaseClient,
  studentIds: string[],
): Promise<
  Map<string, { scorePct: number | null; attendancePct: number | null }>
> {
  const out = new Map<string, { scorePct: number | null; attendancePct: number | null }>();
  if (studentIds.length === 0) return out;

  const [{ data: scores }, { data: attendance }] = await Promise.all([
    supabase
      .from("edu_scores")
      .select("student_id, score, status, edu_assessments(max_score)")
      .in("student_id", studentIds),
    supabase
      .from("edu_attendance")
      .select("student_id, status")
      .in("student_id", studentIds),
  ]);

  const acc = new Map<
    string,
    { earned: number; possible: number; weighted: number; sessions: number }
  >();
  for (const id of studentIds) {
    acc.set(id, { earned: 0, possible: 0, weighted: 0, sessions: 0 });
  }

  for (const s of (scores ?? []) as Row[]) {
    const bucket = acc.get(String(s.student_id));
    if (!bucket || !COUNTED.has(String(s.status))) continue;
    const max = Number(one(s.edu_assessments).max_score ?? 0);
    bucket.possible += max;
    if (s.status === "graded") bucket.earned += Number(s.score ?? 0);
  }

  for (const a of (attendance ?? []) as Row[]) {
    const bucket = acc.get(String(a.student_id));
    if (!bucket) continue;
    bucket.sessions += 1;
    if (a.status === "present") bucket.weighted += 1;
    else if (a.status === "late") bucket.weighted += 0.5;
  }

  for (const [id, b] of acc) {
    out.set(id, {
      scorePct: pct(b.earned, b.possible),
      attendancePct: pct(b.weighted, b.sessions),
    });
  }
  return out;
}

/** Deterministic fallback risk band, used when no AI insight exists yet. */
export function heuristicRisk(
  scorePct: number | null,
  attendancePct: number | null,
): "low" | "medium" | "high" | "unknown" {
  if (scorePct === null && attendancePct === null) return "unknown";
  const s = scorePct ?? 100;
  const a = attendancePct ?? 100;
  if (s < 50 || a < 65) return "high";
  if (s < 70 || a < 80) return "medium";
  return "low";
}

export function fmtPct(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}
