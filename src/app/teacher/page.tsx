import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { buildCohortSummary, fmtPct, heuristicRisk } from "@/lib/academics";
import { Card, Empty, Meter, RiskBadge, SectionTitle, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TeacherHome() {
  const profile = await requireRole("teacher");
  const supabase = await createClient();

  const { data: teacher } = await supabase
    .from("edu_teachers")
    .select("id, department, designation")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!teacher) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Empty
          title="Your faculty record isn't set up yet"
          body="Your account exists but has not been linked to a faculty record. An administrator needs to complete it before your courses can appear."
        />
      </div>
    );
  }

  const { data: courses } = await supabase
    .from("edu_courses")
    .select("id, code, title, credits, schedule, semester")
    .eq("teacher_id", teacher.id)
    .order("code");

  const { data: enrollments } = await supabase
    .from("edu_enrollments")
    .select("student_id, course_id, edu_students(id, roll_no, class_name, edu_profiles(full_name))");

  const studentIds = Array.from(new Set((enrollments ?? []).map((e) => String(e.student_id))));
  const summary = await buildCohortSummary(supabase, studentIds);

  const byCourse = new Map<string, string[]>();
  for (const e of enrollments ?? []) {
    const list = byCourse.get(String(e.course_id)) ?? [];
    list.push(String(e.student_id));
    byCourse.set(String(e.course_id), list);
  }

  // Unique students across all of this teacher's courses, ranked by risk.
  const seen = new Map<string, { name: string; roll: string; cls: string }>();
  for (const e of enrollments ?? []) {
    const s = (e.edu_students ?? null) as {
      id?: string;
      roll_no?: string;
      class_name?: string;
      edu_profiles?: { full_name?: string } | null;
    } | null;
    if (!s?.id || seen.has(s.id)) continue;
    seen.set(s.id, {
      name: s.edu_profiles?.full_name ?? "Student",
      roll: s.roll_no ?? "—",
      cls: s.class_name ?? "—",
    });
  }

  const RANK = { high: 0, medium: 1, low: 2, unknown: 3 } as const;
  const roster = Array.from(seen.entries())
    .map(([id, s]) => {
      const m = summary.get(id) ?? { scorePct: null, attendancePct: null };
      return { id, ...s, ...m, risk: heuristicRisk(m.scorePct, m.attendancePct) };
    })
    .sort((a, b) => RANK[a.risk] - RANK[b.risk] || (a.scorePct ?? 101) - (b.scorePct ?? 101));

  const atRisk = roster.filter((r) => r.risk === "high").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {profile.full_name}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {teacher.designation} · {teacher.department}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Courses taught" value={String((courses ?? []).length)} />
        <Stat label="Students" value={String(roster.length)} sub="Across all your courses" />
        <Stat
          label="High academic risk"
          value={String(atRisk)}
          sub={atRisk > 0 ? "Needs intervention" : "None flagged"}
          tone={atRisk > 0 ? "bad" : "good"}
        />
      </div>

      <div className="mt-10">
        <SectionTitle>Your courses</SectionTitle>
        {(courses ?? []).length === 0 ? (
          <Empty
            title="No courses assigned"
            body="An administrator has not assigned any course to you for this semester yet."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses!.map((c) => (
              <Link key={c.id} href={`/teacher/course/${c.id}`} className="block">
                <Card className="h-full transition hover:border-indigo-300 hover:shadow-md">
                  <p className="font-mono text-xs font-semibold text-indigo-600">{c.code}</p>
                  <h3 className="mt-0.5 font-semibold text-slate-900">{c.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">{c.schedule}</p>
                  <p className="mt-3 text-sm font-medium text-slate-700">
                    {(byCourse.get(c.id) ?? []).length} students enrolled
                  </p>
                  <p className="mt-3 text-sm font-semibold text-indigo-600">
                    Take attendance &amp; enter marks →
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10">
        <SectionTitle hint="Ranked by risk — highest first">Students you teach</SectionTitle>
        {roster.length === 0 ? (
          <Empty
            title="No students yet"
            body="Once students are enrolled in your courses they will appear here with their performance and risk band."
          />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Student</th>
                  <th className="px-5 py-3 font-medium">Score</th>
                  <th className="px-5 py-3 font-medium">Attendance</th>
                  <th className="px-5 py-3 font-medium">Risk</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roster.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{s.name}</p>
                      <p className="text-xs text-slate-500">
                        {s.roll} · {s.cls}
                      </p>
                    </td>
                    <td className="w-40 px-5 py-3">
                      <Meter value={s.scorePct} />
                    </td>
                    <td className="w-40 px-5 py-3">
                      <Meter value={s.attendancePct} tone="attendance" />
                    </td>
                    <td className="px-5 py-3">
                      <RiskBadge level={s.risk} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/teacher/student/${s.id}`}
                        className="text-sm font-semibold text-indigo-600 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Risk bands here are a deterministic rule of thumb ({fmtPct(50)} score or{" "}
          {fmtPct(65)} attendance flags high). Open a student to run the full AI
          analysis.
        </p>
      </div>
    </div>
  );
}
