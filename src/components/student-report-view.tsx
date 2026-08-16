import { fmtPct, heuristicRisk } from "@/lib/academics";
import type { StudentReport } from "@/lib/types";
import { Card, Empty, Meter, RiskBadge, SectionTitle, Stat } from "./ui";

export default function StudentReportView({ report }: { report: StudentReport }) {
  const risk = heuristicRisk(report.overallScorePct, report.overallAttendancePct);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{report.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {report.rollNo} · {report.className}
          </p>
        </div>
        <RiskBadge level={risk} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Overall score" value={fmtPct(report.overallScorePct)} sub="Graded work only" />
        <Stat
          label="Attendance"
          value={fmtPct(report.overallAttendancePct)}
          sub="Late counts as half"
        />
        <Stat label="Courses" value={String(report.courses.length)} />
      </div>

      <div className="mt-8">
        <SectionTitle>Per-course breakdown</SectionTitle>
        {report.courses.length === 0 ? (
          <Empty
            title="Not enrolled in any course"
            body="This student has no enrollments, so there is no attendance or marks history to show."
          />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Course</th>
                  <th className="px-5 py-3 font-medium">Marks</th>
                  <th className="px-5 py-3 font-medium">Score</th>
                  <th className="px-5 py-3 font-medium">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.courses.map((c) => (
                  <tr key={c.courseId}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{c.code}</p>
                      <p className="truncate text-xs text-slate-500">{c.title}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs tabular-nums text-slate-600">
                      {c.possible > 0 ? `${c.earned}/${c.possible}` : "—"}
                      {c.missing > 0 ? (
                        <span className="ml-1 font-semibold text-rose-600">
                          ({c.missing} missed)
                        </span>
                      ) : null}
                    </td>
                    <td className="w-40 px-5 py-3">
                      <Meter value={c.scorePct} />
                    </td>
                    <td className="w-40 px-5 py-3">
                      <Meter value={c.attendancePct} tone="attendance" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </>
  );
}
