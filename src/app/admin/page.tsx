import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { buildCohortSummary, heuristicRisk } from "@/lib/academics";
import { Card, Empty, Meter, RiskBadge, SectionTitle, Stat } from "@/components/ui";
import { AssignTeacherForm, CreateCourseForm, EnrollForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const profile = await requireRole("admin");
  const supabase = await createClient();

  const [{ data: students }, { data: teachers }, { data: courses }, { data: insights }] =
    await Promise.all([
      supabase
        .from("edu_students")
        .select("id, roll_no, class_name, edu_profiles(full_name, email)")
        .order("roll_no"),
      supabase.from("edu_teachers").select("id, full_name, department, designation").order("full_name"),
      supabase
        .from("edu_courses")
        .select("id, code, title, credits, teacher_id, edu_teachers(full_name)")
        .order("code"),
      supabase
        .from("edu_ai_insights")
        .select("student_id, risk_level, created_at")
        .order("created_at", { ascending: false }),
    ]);

  const studentIds = (students ?? []).map((s) => String(s.id));
  const summary = await buildCohortSummary(supabase, studentIds);

  // Most recent AI verdict per student, if one has been generated.
  const aiRisk = new Map<string, string>();
  for (const i of insights ?? []) {
    const key = String(i.student_id);
    if (!aiRisk.has(key)) aiRisk.set(key, String(i.risk_level));
  }

  const RANK = { high: 0, medium: 1, low: 2, unknown: 3 } as const;
  const rows = (students ?? [])
    .map((s) => {
      const p = (s.edu_profiles ?? null) as { full_name?: string; email?: string } | null;
      const m = summary.get(String(s.id)) ?? { scorePct: null, attendancePct: null };
      const computed = heuristicRisk(m.scorePct, m.attendancePct);
      return {
        id: String(s.id),
        name: p?.full_name ?? "Student",
        email: p?.email ?? "",
        roll: s.roll_no as string,
        cls: s.class_name as string,
        ...m,
        computed,
        ai: aiRisk.get(String(s.id)) ?? null,
      };
    })
    .sort((a, b) => RANK[a.computed] - RANK[b.computed] || a.roll.localeCompare(b.roll));

  const high = rows.filter((r) => r.computed === "high").length;
  const medium = rows.filter((r) => r.computed === "medium").length;

  const teacherOptions = (teachers ?? []).map((t) => ({
    id: String(t.id),
    label: `${t.full_name} — ${t.department}`,
  }));
  const courseOptions = (courses ?? []).map((c) => ({
    id: String(c.id),
    label: `${c.code} — ${c.title}`,
  }));
  const studentOptions = rows.map((r) => ({ id: r.id, label: `${r.roll} — ${r.name}` }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        Administration
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Signed in as {profile.full_name} · institution-wide view
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Students" value={String(rows.length)} />
        <Stat label="Faculty" value={String((teachers ?? []).length)} />
        <Stat label="Courses" value={String((courses ?? []).length)} />
        <Stat
          label="Academic risk"
          value={`${high} high`}
          sub={`${medium} medium · ${rows.length - high - medium} low`}
          tone={high > 0 ? "bad" : "good"}
        />
      </div>

      <div className="mt-10">
        <SectionTitle hint="Rule-based band, plus the latest AI verdict where one exists">
          Institution risk roll-up
        </SectionTitle>
        {rows.length === 0 ? (
          <Empty title="No students yet" body="Add students to see the risk roll-up." />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Student</th>
                  <th className="px-5 py-3 font-medium">Score</th>
                  <th className="px-5 py-3 font-medium">Attendance</th>
                  <th className="px-5 py-3 font-medium">Band</th>
                  <th className="px-5 py-3 font-medium">AI verdict</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{r.name}</p>
                      <p className="text-xs text-slate-500">
                        {r.roll} · {r.cls}
                      </p>
                    </td>
                    <td className="w-36 px-5 py-3">
                      <Meter value={r.scorePct} />
                    </td>
                    <td className="w-36 px-5 py-3">
                      <Meter value={r.attendancePct} tone="attendance" />
                    </td>
                    <td className="px-5 py-3">
                      <RiskBadge level={r.computed} />
                    </td>
                    <td className="px-5 py-3">
                      {r.ai ? (
                        <RiskBadge level={r.ai} />
                      ) : (
                        <span className="text-xs text-slate-400">not generated</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/admin/student/${r.id}`}
                        className="text-sm font-semibold text-indigo-600 hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <div>
          <SectionTitle>Create a course</SectionTitle>
          <Card>
            <CreateCourseForm teachers={teacherOptions} />
          </Card>
        </div>
        <div>
          <SectionTitle>Enroll a student</SectionTitle>
          <Card>
            <EnrollForm students={studentOptions} courses={courseOptions} />
          </Card>
        </div>
        <div>
          <SectionTitle>Reassign a course</SectionTitle>
          <Card>
            <AssignTeacherForm courses={courseOptions} teachers={teacherOptions} />
          </Card>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <SectionTitle>Faculty</SectionTitle>
          <Card className="p-0">
            <ul className="divide-y divide-slate-100">
              {(teachers ?? []).map((t) => (
                <li key={t.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-slate-900">{t.full_name}</p>
                  <p className="text-xs text-slate-500">
                    {t.designation} · {t.department}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div>
          <SectionTitle>Courses</SectionTitle>
          <Card className="p-0">
            <ul className="divide-y divide-slate-100">
              {(courses ?? []).map((c) => {
                const t = (c.edu_teachers ?? null) as { full_name?: string } | null;
                return (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="font-mono text-xs font-semibold text-indigo-600">{c.code}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{c.title}</span>
                    <span className="truncate text-xs text-slate-500">
                      {t?.full_name ?? "Unassigned"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
