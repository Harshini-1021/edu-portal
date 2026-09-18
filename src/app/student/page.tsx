import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { buildStudentReport, fmtPct, heuristicRisk } from "@/lib/academics";
import { TrendChart } from "@/components/charts";
import { Card, Empty, Meter, RiskBadge, SectionTitle, Stat } from "@/components/ui";
import AiInsightPanel from "@/components/ai-insight";
import type { Insight } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StudentDashboard() {
  const profile = await requireRole("student");
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("edu_students")
    .select("id, roll_no, class_name, batch")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!student) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Empty
          title="Your student record isn't set up yet"
          body="Your account exists but has not been linked to a student record. An administrator needs to complete your enrollment before your dashboard can show anything."
        />
      </div>
    );
  }

  const [report, { data: insightRow }, { data: sessions }] = await Promise.all([
    buildStudentReport(supabase, student.id),
    supabase
      .from("edu_ai_insights")
      .select("*")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("edu_attendance")
      .select("session_date, status")
      .eq("student_id", student.id)
      .order("session_date"),
  ]);

  // Cumulative attendance after each recorded session. Cumulative rather than
  // per-day because a single absent day is noise; what matters to a student on
  // the edge of the 75% rule is which side of it they are drifting towards.
  const trend = (() => {
    const byDate = new Map<string, { weighted: number; total: number }>();
    for (const row of sessions ?? []) {
      const key = String(row.session_date);
      const bucket = byDate.get(key) ?? { weighted: 0, total: 0 };
      bucket.total += 1;
      if (row.status === "present") bucket.weighted += 1;
      else if (row.status === "late") bucket.weighted += 0.5;
      byDate.set(key, bucket);
    }

    let weighted = 0;
    let total = 0;
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => {
        weighted += b.weighted;
        total += b.total;
        return {
          label: new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
          value: Math.round((weighted / total) * 1000) / 10,
        };
      });
  })();

  const courses = report?.courses ?? [];
  const risk = heuristicRisk(
    report?.overallScorePct ?? null,
    report?.overallAttendancePct ?? null,
  );

  const pendingCount = courses.reduce((n, c) => n + c.pending, 0);
  const missingCount = courses.reduce((n, c) => n + c.missing, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {profile.full_name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {student.roll_no} · {student.class_name} · Batch {student.batch}
          </p>
        </div>
        <RiskBadge level={risk} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Overall score"
          value={fmtPct(report?.overallScorePct ?? null)}
          sub="Graded work only"
          tone={
            report?.overallScorePct === null || report?.overallScorePct === undefined
              ? "default"
              : report.overallScorePct >= 75
                ? "good"
                : report.overallScorePct >= 55
                  ? "warn"
                  : "bad"
          }
        />
        <Stat
          label="Attendance"
          value={fmtPct(report?.overallAttendancePct ?? null)}
          sub="Late counts as half"
          tone={
            report?.overallAttendancePct === null || report?.overallAttendancePct === undefined
              ? "default"
              : report.overallAttendancePct >= 80
                ? "good"
                : report.overallAttendancePct >= 65
                  ? "warn"
                  : "bad"
          }
        />
        <Stat label="Courses enrolled" value={String(courses.length)} />
        <Stat
          label="Awaiting evaluation"
          value={String(pendingCount)}
          sub={missingCount > 0 ? `${missingCount} missed submission${missingCount === 1 ? "" : "s"}` : "Nothing missed"}
          tone={missingCount > 0 ? "bad" : "default"}
        />
      </div>

      <div className="mt-6">
        <TrendChart
          points={trend}
          threshold={75}
          caption="Running attendance after each recorded session, against the 75% requirement."
        />
      </div>

      <div className="mt-8">
        <AiInsightPanel studentId={student.id} initial={(insightRow as Insight) ?? null} />
      </div>

      <div className="mt-10">
        <SectionTitle hint="Pending work is excluded from the score; missed submissions count as zero">
          Your courses
        </SectionTitle>

        {courses.length === 0 ? (
          <Empty
            title="You are not enrolled in any course yet"
            body="Once an administrator enrolls you, your courses, attendance and marks will appear here."
            action={
              <Link href="/courses" className="text-sm font-semibold text-indigo-600 hover:underline">
                Browse the catalogue →
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {courses.map((c) => (
              <Card key={c.courseId}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/courses/${c.code}`}
                      className="font-mono text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      {c.code}
                    </Link>
                    <h3 className="truncate font-semibold text-slate-900">{c.title}</h3>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {c.teacher} · {c.schedule}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {c.credits} cr
                  </span>
                </div>

                <dl className="mt-4 space-y-3">
                  <div>
                    <dt className="mb-1 flex justify-between text-xs font-medium text-slate-500">
                      <span>Score</span>
                      <span className="tabular-nums">
                        {c.possible > 0 ? `${c.earned}/${c.possible} marks` : "not graded yet"}
                      </span>
                    </dt>
                    <dd>
                      <Meter value={c.scorePct} />
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-1 flex justify-between text-xs font-medium text-slate-500">
                      <span>Attendance</span>
                      <span className="tabular-nums">
                        {c.sessions > 0
                          ? `${c.present} present · ${c.late} late · ${c.absent} absent`
                          : "no sessions recorded"}
                      </span>
                    </dt>
                    <dd>
                      <Meter value={c.attendancePct} tone="attendance" />
                    </dd>
                  </div>
                </dl>

                {c.pending > 0 || c.missing > 0 ? (
                  <p className="mt-3 text-xs text-slate-500">
                    {c.pending > 0 ? `${c.pending} awaiting evaluation` : null}
                    {c.pending > 0 && c.missing > 0 ? " · " : null}
                    {c.missing > 0 ? (
                      <span className="font-medium text-rose-600">
                        {c.missing} missed, counted as zero
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
