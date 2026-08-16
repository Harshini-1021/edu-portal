"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { ok: boolean; message: string } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ATT = new Set(["present", "absent", "late"]);

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
  const courseId = String(formData.get("course_id") ?? "");
  const date = String(formData.get("session_date") ?? "");

  if (!UUID.test(courseId)) return { ok: false, message: "Invalid course." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Pick a valid date." };

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (new Date(date) > today) {
    return { ok: false, message: "Attendance cannot be recorded for a future date." };
  }

  const rows: { student_id: string; course_id: string; session_date: string; status: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("status:")) continue;
    const studentId = key.slice(7);
    const status = String(value);
    if (!UUID.test(studentId) || !ATT.has(status)) continue;
    rows.push({ student_id: studentId, course_id: courseId, session_date: date, status });
  }

  if (rows.length === 0) return { ok: false, message: "No students to record." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("edu_attendance")
    .upsert(rows, { onConflict: "student_id,course_id,session_date" });

  if (error) {
    return {
      ok: false,
      message:
        error.code === "42501"
          ? "You can only record attendance for your own courses."
          : "Could not save attendance. Please try again.",
    };
  }

  revalidatePath(`/teacher/course/${courseId}`);
  revalidatePath("/teacher");
  return {
    ok: true,
    message: `Attendance saved for ${rows.length} student${rows.length === 1 ? "" : "s"} on ${date}.`,
  };
}

/**
 * Saves marks for one assessment. An empty box means "not evaluated yet" and
 * stores a pending row rather than a zero — a blank must never look like a fail.
 */
export async function saveMarks(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const assessmentId = String(formData.get("assessment_id") ?? "");
  if (!UUID.test(assessmentId)) return { ok: false, message: "Pick an assessment first." };

  const supabase = await createClient();

  const { data: assessment } = await supabase
    .from("edu_assessments")
    .select("id, max_score, course_id, title")
    .eq("id", assessmentId)
    .maybeSingle();

  if (!assessment) {
    return { ok: false, message: "That assessment is not available to you." };
  }

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
    if (!UUID.test(studentId)) continue;

    const raw = String(value).trim();

    if (raw === "") {
      rows.push({
        assessment_id: assessmentId,
        student_id: studentId,
        score: null,
        status: "pending",
        graded_at: null,
      });
      continue;
    }

    if (raw.toLowerCase() === "a" || raw.toLowerCase() === "absent") {
      rows.push({
        assessment_id: assessmentId,
        student_id: studentId,
        score: 0,
        status: "missing",
        graded_at: new Date().toISOString(),
      });
      continue;
    }

    const score = Number(raw);
    if (!Number.isFinite(score) || score < 0) {
      return { ok: false, message: `“${raw}” is not a valid mark. Use a number, or leave it blank.` };
    }
    if (score > assessment.max_score) {
      return {
        ok: false,
        message: `Marks cannot exceed ${assessment.max_score} for “${assessment.title}”.`,
      };
    }

    rows.push({
      assessment_id: assessmentId,
      student_id: studentId,
      score,
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

  revalidatePath(`/teacher/course/${assessment.course_id}`);
  revalidatePath("/teacher");
  const graded = rows.filter((r) => r.status === "graded").length;
  return { ok: true, message: `Saved ${graded} mark${graded === 1 ? "" : "s"} for “${assessment.title}”.` };
}
