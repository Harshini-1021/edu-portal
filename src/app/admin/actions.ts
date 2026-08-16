"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AdminState = { ok: boolean; message: string } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createCourse(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const schedule = String(formData.get("schedule") ?? "").trim() || "TBD";
  const teacherId = String(formData.get("teacher_id") ?? "");
  const credits = Number(formData.get("credits") ?? 3);

  if (!/^[A-Z]{2,4}\d{3}$/.test(code)) {
    return { ok: false, message: "Course code must look like CS301 or MA201." };
  }
  if (title.length < 3 || title.length > 120) {
    return { ok: false, message: "Give the course a title between 3 and 120 characters." };
  }
  if (!Number.isInteger(credits) || credits < 1 || credits > 10) {
    return { ok: false, message: "Credits must be a whole number between 1 and 10." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("edu_courses").insert({
    code,
    title,
    description,
    schedule,
    credits,
    teacher_id: UUID.test(teacherId) ? teacherId : null,
  });

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

  revalidatePath("/admin");
  revalidatePath("/courses");
  return { ok: true, message: `Course ${code} created.` };
}

export async function enrollStudent(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const studentId = String(formData.get("student_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");

  if (!UUID.test(studentId) || !UUID.test(courseId)) {
    return { ok: false, message: "Pick both a student and a course." };
  }

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

  revalidatePath("/admin");
  return { ok: true, message: "Student enrolled." };
}

export async function assignTeacher(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const courseId = String(formData.get("course_id") ?? "");
  const teacherId = String(formData.get("teacher_id") ?? "");

  if (!UUID.test(courseId)) return { ok: false, message: "Pick a course." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("edu_courses")
    .update({ teacher_id: UUID.test(teacherId) ? teacherId : null })
    .eq("id", courseId);

  if (error) {
    return { ok: false, message: "Could not reassign the course. Please try again." };
  }

  revalidatePath("/admin");
  revalidatePath("/courses");
  return { ok: true, message: "Course reassigned." };
}
