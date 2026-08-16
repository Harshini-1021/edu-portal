import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { Card, Pill, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CourseDetail({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();
  const profile = await getProfile();

  const { data: course } = await supabase
    .from("edu_courses")
    .select(
      "id, code, title, description, credits, schedule, semester, edu_teachers(full_name, department, designation)",
    )
    .eq("code", decodeURIComponent(code).toUpperCase())
    .maybeSingle();

  if (!course) notFound();

  const teacher = (course.edu_teachers ?? null) as
    | { full_name?: string; department?: string; designation?: string }
    | null;

  // Assessments are visible to enrolled students, the course teacher and admins.
  // RLS returns an empty list to everyone else, which is exactly what we render.
  const { data: assessments } = await supabase
    .from("edu_assessments")
    .select("id, title, kind, max_score, due_date")
    .eq("course_id", course.id)
    .order("due_date");

  const { count: enrolled } = await supabase
    .from("edu_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("course_id", course.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/courses" className="text-sm font-medium text-indigo-600 hover:underline">
        ← All courses
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold text-indigo-600">{course.code}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {course.title}
          </h1>
        </div>
        <div className="flex gap-2">
          <Pill>{course.credits} credits</Pill>
          <Pill>{course.semester}</Pill>
        </div>
      </div>

      <p className="mt-4 max-w-2xl leading-relaxed text-slate-600">{course.description}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Faculty</p>
          <p className="mt-1 font-semibold text-slate-900">{teacher?.full_name ?? "Unassigned"}</p>
          <p className="text-xs text-slate-500">
            {teacher?.designation ?? "—"}
            {teacher?.department ? ` · ${teacher.department}` : ""}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Schedule</p>
          <p className="mt-1 font-semibold text-slate-900">{course.schedule}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Enrolled</p>
          <p className="mt-1 font-semibold text-slate-900">
            {enrolled ?? 0} student{enrolled === 1 ? "" : "s"}
          </p>
        </Card>
      </div>

      <div className="mt-10">
        <SectionTitle hint={profile ? undefined : "Sign in to see assessments"}>
          Assessments &amp; examinations
        </SectionTitle>
        {(assessments ?? []).length === 0 ? (
          <Card>
            <p className="text-sm text-slate-600">
              {profile
                ? "No assessments have been published for this course yet, or you are not enrolled in it."
                : "Assessment schedules are visible to enrolled students, the course faculty and administrators."}
            </p>
            {!profile ? (
              <Link
                href={`/login?next=/courses/${course.code}`}
                className="mt-3 inline-block text-sm font-semibold text-indigo-600 hover:underline"
              >
                Sign in →
              </Link>
            ) : null}
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <ul className="divide-y divide-slate-100">
              {assessments!.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${
                      a.kind === "exam"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-indigo-50 text-indigo-700"
                    }`}
                  >
                    {a.kind}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                    {a.title}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(a.due_date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <span className="text-xs font-medium tabular-nums text-slate-600">
                    {a.max_score} marks
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
