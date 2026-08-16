"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { markAttendance, saveMarks, type ActionState } from "../../actions";

type Student = { id: string; name: string; roll: string };

function Result({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <p
      role="status"
      className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset ${
        state.ok
          ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
          : "bg-rose-50 text-rose-700 ring-rose-200"
      }`}
    >
      {state.message}
    </p>
  );
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

const OPTIONS = [
  { value: "present", label: "Present", on: "bg-emerald-600 text-white", off: "text-emerald-700 hover:bg-emerald-50" },
  { value: "late", label: "Late", on: "bg-amber-500 text-white", off: "text-amber-700 hover:bg-amber-50" },
  { value: "absent", label: "Absent", on: "bg-rose-600 text-white", off: "text-rose-700 hover:bg-rose-50" },
] as const;

export function AttendanceForm({
  courseId,
  date,
  students,
  existing,
}: {
  courseId: string;
  date: string;
  students: Student[];
  existing: Record<string, string>;
}) {
  const [state, action] = useActionState<ActionState, FormData>(markAttendance, null);
  const [marks, setMarks] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const s of students) seed[s.id] = existing[s.id] ?? "present";
    return seed;
  });

  const alreadyRecorded = Object.keys(existing).length > 0;

  return (
    <form action={action}>
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="session_date" value={date} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {alreadyRecorded ? (
            <>
              Attendance for this date is already recorded — saving again{" "}
              <strong>updates</strong> it.
            </>
          ) : (
            "No attendance recorded for this date yet."
          )}
        </p>
        <button
          type="button"
          onClick={() =>
            setMarks(Object.fromEntries(students.map((s) => [s.id, "present"])))
          }
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Mark all present
        </button>
      </div>

      <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {students.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{s.name}</p>
              <p className="font-mono text-xs text-slate-500">{s.roll}</p>
            </div>
            <input type="hidden" name={`status:${s.id}`} value={marks[s.id] ?? "present"} />
            <div className="flex overflow-hidden rounded-lg border border-slate-200">
              {OPTIONS.map((o) => {
                const active = (marks[s.id] ?? "present") === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setMarks((m) => ({ ...m, [s.id]: o.value }))}
                    className={`px-3 py-1.5 text-xs font-semibold transition ${active ? o.on : `bg-white ${o.off}`}`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      <Result state={state} />

      <div className="mt-4">
        <SaveButton label="Save attendance" />
      </div>
    </form>
  );
}

export function MarksForm({
  assessmentId,
  assessmentTitle,
  maxScore,
  students,
  existing,
}: {
  assessmentId: string;
  assessmentTitle: string;
  maxScore: number;
  students: Student[];
  existing: Record<string, { score: number | null; status: string }>;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveMarks, null);

  return (
    <form action={action}>
      <input type="hidden" name="assessment_id" value={assessmentId} />

      <p className="text-sm text-slate-600">
        Entering marks for <strong>{assessmentTitle}</strong>, out of {maxScore}.
        Leave a box empty to keep it awaiting evaluation, or type{" "}
        <code className="rounded bg-slate-100 px-1 font-mono text-xs">a</code> to
        record a missed submission as zero.
      </p>

      <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {students.map((s) => {
          const row = existing[s.id];
          const value =
            row?.status === "graded" && row.score !== null
              ? String(row.score)
              : row?.status === "missing"
                ? "a"
                : "";
          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{s.name}</p>
                <p className="font-mono text-xs text-slate-500">{s.roll}</p>
              </div>
              {row?.status === "missing" ? (
                <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                  missed
                </span>
              ) : null}
              <input
                name={`score:${s.id}`}
                defaultValue={value}
                inputMode="decimal"
                aria-label={`Marks for ${s.name} out of ${maxScore}`}
                placeholder="—"
                className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-right text-sm tabular-nums outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <span className="w-12 text-xs text-slate-400">/ {maxScore}</span>
            </li>
          );
        })}
      </ul>

      <Result state={state} />

      <div className="mt-4">
        <SaveButton label="Save marks" />
      </div>
    </form>
  );
}
