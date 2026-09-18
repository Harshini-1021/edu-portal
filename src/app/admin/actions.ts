"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import {
  createCourseInput,
  enrollStudentInput,
  assignTeacherInput,
  parseOrMessage,
} from "@/lib/schemas";

export type AdminState = { ok: boolean; message: string } | null;

export async function createCourse(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = parseOrMessage(createCourseInput, {
    code: formData.get("code") ?? "",
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    schedule: String(formData.get("schedule") ?? "").trim() || "TBD",
    credits: formData.get("credits") ?? 3,
    teacherId: formData.get("teacher_id") ?? "",
  });
  if (!parsed.ok) return { ok: false, message: parsed.message };

  const { code, title, description, schedule, credits, teacherId } = parsed.data;

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("edu_courses")
    .insert({ code, title, description, schedule, credits, teacher_id: teacherId })
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      message:
        error.code === "23505"
          ? `Course code ${code} already exists.`
          : error.code === "42501"
            ? "Only an administrator can create courses."
            : "Could not create the course. Please try again.",
    };
  }

  await recordAudit(supabase, await getProfile(), {
    action: "course.create",
    entity: "edu_courses",
    entityId: created?.id ?? null,
    summary: `Created course ${code} — ${title}.`,
    detail: { code, title, credits, schedule, teacher_id: teacherId },
  });

  revalidatePath("/admin");
  revalidatePath("/courses");
  return { ok: true, message: `Course ${code} created.` };
}

export async function enrollStudent(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = parseOrMessage(enrollStudentInput, {
    studentId: formData.get("student_id") ?? "",
    courseId: formData.get("course_id") ?? "",
  });
  if (!parsed.ok) return { ok: false, message: "Pick both a student and a course." };

  const { studentId, courseId } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("edu_enrollments")
    .insert({ student_id: studentId, course_id: courseId });

  if (error) {
    return {
      ok: false,
      message:
        error.code === "23505"
          ? "That student is already enrolled in this course."
          : error.code === "42501"
            ? "Only an administrator can change enrollments."
            : "Could not enroll the student. Please try again.",
    };
  }

  await recordAudit(supabase, await getProfile(), {
    action: "enrollment.create",
    entity: "edu_enrollments",
    entityId: courseId,
    summary: "Enrolled a student in a course.",
    detail: { student_id: studentId, course_id: courseId },
  });

  revalidatePath("/admin");
  return { ok: true, message: "Student enrolled." };
}

export async function assignTeacher(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = parseOrMessage(assignTeacherInput, {
    courseId: formData.get("course_id") ?? "",
    teacherId: formData.get("teacher_id") ?? "",
  });
  if (!parsed.ok) return { ok: false, message: "Pick a course." };

  const { courseId, teacherId } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("edu_courses")
    .update({ teacher_id: teacherId })
    .eq("id", courseId);

  if (error) {
    return { ok: false, message: "Could not reassign the course. Please try again." };
  }

  await recordAudit(supabase, await getProfile(), {
    action: "course.assign_teacher",
    entity: "edu_courses",
    entityId: courseId,
    summary: teacherId ? "Reassigned a course to a different teacher." : "Removed the teacher from a course.",
    detail: { course_id: courseId, teacher_id: teacherId },
  });

  revalidatePath("/admin");
  revalidatePath("/courses");
  return { ok: true, message: "Course reassigned." };
}
