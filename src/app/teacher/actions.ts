"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import {
  markAttendanceInput,
  saveMarksInput,
  markCell,
  gradedScore,
  parseOrMessage,
} from "@/lib/schemas";

export type ActionState = { ok: boolean; message: string } | null;

/**
 * Records attendance for one course on one date. Writes are upserts on
 * (student, course, date), so marking the same day twice edits rather than
 * duplicating. RLS rejects the whole statement if the caller does not teach
 * this course, so ownership is never taken on trust from the form.
 */
export async function markAttendance(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const entries: { studentId: string; status: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("status:")) continue;
    entries.push({ studentId: key.slice(7), status: String(value) });
  }

  const parsed = parseOrMessage(markAttendanceInput, {
    courseId: String(formData.get("course_id") ?? ""),
    sessionDate: String(formData.get("session_date") ?? ""),
    entries,
  });
  if (!parsed.ok) return { ok: false, message: parsed.message };

  const { courseId, sessionDate, entries: rows } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("edu_attendance").upsert(
    rows.map((r) => ({
      student_id: r.studentId,
      course_id: courseId,
      session_date: sessionDate,
      status: r.status,
    })),
    { onConflict: "student_id,course_id,session_date" },
  );

  if (error) {
    return {
      ok: false,
      message:
        error.code === "42501"
          ? "You can only record attendance for your own courses."
          : "Could not save attendance. Please try again.",
    };
  }

  const present = rows.filter((r) => r.status === "present").length;
  const absent = rows.filter((r) => r.status === "absent").length;
  const late = rows.filter((r) => r.status === "late").length;

  await recordAudit(supabase, await getProfile(), {
    action: "attendance.mark",
    entity: "edu_attendance",
    entityId: courseId,
    summary: `Recorded attendance for ${rows.length} student${rows.length === 1 ? "" : "s"} on ${sessionDate}.`,
    detail: { course_id: courseId, session_date: sessionDate, present, absent, late },
  });

  revalidatePath(`/teacher/course/${courseId}`);
  revalidatePath("/teacher");
  return {
    ok: true,
    message: `Attendance saved for ${rows.length} student${rows.length === 1 ? "" : "s"} on ${sessionDate}.`,
  };
}

/**
 * Saves marks for one assessment. An empty box means "not evaluated yet" and
 * stores a pending row rather than a zero — a blank must never look like a fail.
 * The per-cell contract lives in schemas.ts; the ceiling check is built from the
 * assessment's own max_score, so the rule cannot drift from the data.
 */
export async function saveMarks(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const head = parseOrMessage(saveMarksInput, {
    assessmentId: String(formData.get("assessment_id") ?? ""),
  });
  if (!head.ok) return { ok: false, message: "Pick an assessment first." };

  const { assessmentId } = head.data;
  const supabase = await createClient();

  const { data: assessment } = await supabase
    .from("edu_assessments")
    .select("id, max_score, course_id, title")
    .eq("id", assessmentId)
    .maybeSingle();

  if (!assessment) {
    return { ok: false, message: "That assessment is not available to you." };
  }

  const ceiling = gradedScore(assessment.max_score, assessment.title);

  const rows: {
    assessment_id: string;
    student_id: string;
    score: number | null;
    status: string;
    graded_at: string | null;
  }[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("score:")) continue;
    const studentId = key.slice(6);

    const cell = markCell.safeParse(String(value).trim());
    if (!cell.success) {
      return { ok: false, message: `“${String(value).trim()}” is not a valid mark. Use a number, or leave it blank.` };
    }

    if (cell.data.kind === "pending") {
      rows.push({ assessment_id: assessmentId, student_id: studentId, score: null, status: "pending", graded_at: null });
      continue;
    }

    if (cell.data.kind === "missing") {
      rows.push({ assessment_id: assessmentId, student_id: studentId, score: 0, status: "missing", graded_at: new Date().toISOString() });
      continue;
    }

    const bounded = ceiling.safeParse(cell.data.score);
    if (!bounded.success) {
      return { ok: false, message: bounded.error.issues[0].message };
    }

    rows.push({
      assessment_id: assessmentId,
      student_id: studentId,
      score: bounded.data,
      status: "graded",
      graded_at: new Date().toISOString(),
    });
  }

  if (rows.length === 0) return { ok: false, message: "No marks to save." };

  const { error } = await supabase
    .from("edu_scores")
    .upsert(rows, { onConflict: "assessment_id,student_id" });

  if (error) {
    return {
      ok: false,
      message:
        error.code === "42501"
          ? "You can only enter marks for your own courses."
          : "Could not save marks. Please try again.",
    };
  }

  const graded = rows.filter((r) => r.status === "graded").length;

  await recordAudit(supabase, await getProfile(), {
    action: "marks.save",
    entity: "edu_scores",
    entityId: assessmentId,
    summary: `Entered ${graded} mark${graded === 1 ? "" : "s"} for “${assessment.title}”.`,
    detail: {
      assessment_id: assessmentId,
      course_id: assessment.course_id,
      graded,
      pending: rows.filter((r) => r.status === "pending").length,
      missing: rows.filter((r) => r.status === "missing").length,
    },
  });

  revalidatePath(`/teacher/course/${assessment.course_id}`);
  revalidatePath("/teacher");
  return { ok: true, message: `Saved ${graded} mark${graded === 1 ? "" : "s"} for “${assessment.title}”.` };
}
