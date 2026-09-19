"use client";

import { useState } from "react";
import { Card, SectionTitle } from "./ui";
import {
  marksNeeded,
  absenceBuffer,
  describeMarks,
  describeAttendance,
} from "@/lib/whatif";

type CourseInput = {
  code: string;
  title: string;
  earned: number;
  possible: number;
  remainingMax: number;
  present: number;
  late: number;
  absent: number;
};

const TARGETS = [50, 60, 75, 85];

/**
 * Deterministic projections. This component calls no API — every number comes
 * from arithmetic in lib/whatif.ts, so changing the target re-renders instantly
 * and costs nothing. That is the point: the question "can I still pass?"
 * deserves an exact answer, not a generated one.
 */
export default function WhatIfPanel({ courses }: { courses: CourseInput[] }) {
  const [target, setTarget] = useState(60);

  const totals = courses.reduce(
    (acc, c) => ({
      earned: acc.earned + c.earned,
      possible: acc.possible + c.possible,
      remainingMax: acc.remainingMax + c.remainingMax,
      present: acc.present + c.present,
      late: acc.late + c.late,
      absent: acc.absent + c.absent,
    }),
    { earned: 0, possible: 0, remainingMax: 0, present: 0, late: 0, absent: 0 },
  );

  const overall = marksNeeded(totals.earned, totals.possible, totals.remainingMax, target);
  const attendance = absenceBuffer(totals.present, totals.late, totals.absent, 75);

  const toneFor = (kind: string) =>
    kind === "impossible" || kind === "unrecoverable" || kind === "at_risk"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : kind === "already_there" || kind === "safe"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <Card>
      <SectionTitle hint="Calculated, not generated">What if?</SectionTitle>

      <p className="mb-3 text-sm text-slate-600">
        Exact arithmetic on your record — no AI, no estimate. Pick a target to see what it
        would take.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Target
        </span>
        {TARGETS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTarget(t)}
            aria-pressed={target === t}
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
              target === t
                ? "bg-slate-900 text-white ring-slate-900"
                : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-300"
            }`}
          >
            {t}%
          </button>
        ))}
      </div>

      <div className={`mt-4 rounded-xl border px-3 py-2 text-sm ${toneFor(overall.kind)}`}>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
          Overall marks
        </p>
        <p className="mt-0.5">{describeMarks(overall, target)}</p>
      </div>

      <div className={`mt-2 rounded-xl border px-3 py-2 text-sm ${toneFor(attendance.kind)}`}>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
          Attendance
        </p>
        <p className="mt-0.5">{describeAttendance(attendance, 75)}</p>
      </div>

      {courses.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Per course, to reach {target}%
          </p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {courses.map((c) => {
              const p = marksNeeded(c.earned, c.possible, c.remainingMax, target);
              return (
                <li key={c.code} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-800">{c.code}</span>
                  <span className="min-w-0 flex-1 text-xs text-slate-600">
                    {describeMarks(p, target)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
