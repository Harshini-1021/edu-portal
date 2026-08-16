import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { Card, Empty, Pill, SectionTitle } from "@/components/ui";
import { AttendanceForm, MarksForm } from "./forms";

export const dynamic = "force-dynamic";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function CourseWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; date?: string; assessment?: string }>;
}) {
  await requireRole("teacher");
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("edu_courses")
    .select("id, code, title, schedule, credits, semester, teacher_id")
    .eq("id", id)
    .maybeSingle();

  if (!course) notFound();

  // Teachers may read every course (public catalogue) but may only write to
  // their own. Anything else is read-only, so send them back rather than show
  // controls that RLS would reject.
  const { data: myTeacher } = await supabase
    .from("edu_teachers")
    .select("id")
    .maybeSingle();

  if (!myTeacher || course.teacher_id !== myTeacher.id) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Empty
          title="This isn't one of your courses"
          body="You can only record attendance and enter marks for courses assigned to you."
          action={
            <Link href="/teacher" className="text-sm font-semibold text-indigo-600 hover:underline">
              ← Back to your courses
            </Link>
          }
        />
      </div>
    );
  }

  const tab = sp.tab === "marks" ? "marks" : "attendance";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : todayISO();

  const { data: enrollments } = await supabase
    .from("edu_enrollments")
    .select("student_id, edu_students(id, roll_no, edu_profiles(full_name))")
    .eq("course_id", course.id);

  const students = (enrollments ?? [])
    .map((e) => {
      const s = (e.edu_students ?? null) as {
        id?: string;
        roll_no?: string;
        edu_profiles?: { full_name?: string } | null;
      } | null;
      return {
        id: String(s?.id ?? ""),
        roll: s?.roll_no ?? "—",
        name: s?.edu_profiles?.full_name ?? "Student",
      };
    })
    .filter((s) => s.id)
    .sort((a, b) => a.roll.localeCompare(b.roll));

  const { data: assessments } = await supabase
    .from("edu_assessments")
    .select("id, title, kind, max_score, due_date")
    .eq("course_id", course.id)
    .order("due_date", { ascending: false });

  const chosen =
    (assessments ?? []).find((a) => a.id === sp.assessment) ?? (assessments ?? [])[0] ?? null;

  const [{ data: attendanceRows }, { data: scoreRows }] = await Promise.all([
    supabase
      .from("edu_attendance")
      .select("student_id, status")
      .eq("course_id", course.id)
      .eq("session_date", date),
    chosen
      ? supabase
          .from("edu_scores")
          .select("student_id, score, status")
          .eq("assessment_id", chosen.id)
      : Promise.resolve({ data: [] as { student_id: string; score: number | null; status: string }[] }),
  ]);

  const existingAttendance: Record<string, string> = {};
  for (const r of attendanceRows ?? []) existingAttendance[String(r.student_id)] = String(r.status);

  const existingScores: Record<string, { score: number | null; status: string }> = {};
  for (const r of scoreRows ?? []) {
    existingScores[String(r.student_id)] = {
      score: r.score === null ? null : Number(r.score),
      status: String(r.status),
    };
  }

  const tabClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-semibold transition ${
      active ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
    }`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <Link href="/teacher" className="text-sm font-medium text-indigo-600 hover:underline">
        ← Your courses
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold text-indigo-600">{course.code}</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
            {course.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {course.schedule} · {students.length} student{students.length === 1 ? "" : "s"}
          </p>
        </div>
        <Pill>{course.semester}</Pill>
      </div>

      <div className="mt-6 flex gap-2">
        <Link href={`/teacher/course/${course.id}?tab=attendance&date=${date}`} className={tabClass(tab === "attendance")}>
          Attendance
        </Link>
        <Link href={`/teacher/course/${course.id}?tab=marks`} className={tabClass(tab === "marks")}>
          Marks
        </Link>
      </div>

      {students.length === 0 ? (
        <div className="mt-6">
          <Empty
            title="No students enrolled"
            body="Nobody is enrolled in this course yet, so there is no attendance to take and no marks to enter."
          />
        </div>
      ) : tab === "attendance" ? (
        <div className="mt-6">
          <SectionTitle hint="Recording the same date twice edits it — it never duplicates">
            Record attendance
          </SectionTitle>

          <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
            <input type="hidden" name="tab" value="attendance" />
            <div>
              <label htmlFor="date" className="block text-xs font-medium text-slate-600">
                Session date
              </label>
              <input
                id="date"
                name="date"
                type="date"
                defaultValue={date}
                max={todayISO()}
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Load date
            </button>
          </form>

          <AttendanceForm
            courseId={course.id}
            date={date}
            students={students}
            existing={existingAttendance}
          />
        </div>
      ) : (
        <div className="mt-6">
          <SectionTitle>Enter marks</SectionTitle>

          {(assessments ?? []).length === 0 ? (
            <Empty
              title="No assessments yet"
              body="This course has no assignments or examinations defined, so there is nothing to mark."
            />
          ) : (
            <>
              <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
                <input type="hidden" name="tab" value="marks" />
                <div className="min-w-64 flex-1">
                  <label htmlFor="assessment" className="block text-xs font-medium text-slate-600">
                    Assessment
                  </label>
                  <select
                    id="assessment"
                    name="assessment"
                    defaultValue={chosen?.id}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  >
                    {assessments!.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.kind === "exam" ? "Exam" : "Assignment"} · {a.title} ({a.max_score})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Load
                </button>
              </form>

              {chosen ? (
                <MarksForm
                  assessmentId={chosen.id}
                  assessmentTitle={chosen.title}
                  maxScore={chosen.max_score}
                  students={students}
                  existing={existingScores}
                />
              ) : null}
            </>
          )}
        </div>
      )}

      <Card className="mt-8 bg-slate-50">
        <p className="text-xs leading-relaxed text-slate-500">
          Every write here is checked twice: the form validates it, and a
          row-level security policy in Postgres re-checks that this course
          belongs to you. Marks above the maximum are rejected by a database
          trigger as well.
        </p>
      </Card>
    </div>
  );
}
