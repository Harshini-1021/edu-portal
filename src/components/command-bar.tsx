"use client";

import { useState } from "react";
import { Card, SectionTitle } from "./ui";

type Row = { label: string; detail: string; badge?: string };

type Outcome =
  | { kind: "answer"; headline: string; rows: Row[]; model: string }
  | {
      kind: "confirm";
      headline: string;
      diff: { field: string; from: string; to: string }[];
      write: { studentId: string; assessmentId: string; newScore: number };
      model: string;
    }
  | { kind: "clarify"; message: string; options: string[] };

const EXAMPLES = [
  "Show students below 75% attendance",
  "Get Arun's academic performance",
  "Set Arun's Discrete Mathematics midterm mark to 92",
];

export default function CommandBar({ role }: { role: "teacher" | "admin" }) {
  const [utterance, setUtterance] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [planning, setPlanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState("");

  async function run(text: string) {
    const instruction = text.trim();
    if (!instruction || planning) return; // a double click must not fire two plans

    setPlanning(true);
    setError(null);
    setDone(null);
    setOutcome(null);
    setLastRun(instruction);

    try {
      const res = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ utterance: instruction }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "That instruction could not be carried out.");
        return;
      }
      setOutcome(json as Outcome);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPlanning(false);
    }
  }

  async function confirm() {
    if (!outcome || outcome.kind !== "confirm" || applying) return;
    setApplying(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/command/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...outcome.write, utterance: lastRun }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "The change could not be applied.");
        return;
      }
      setDone(json.message ?? "Change applied.");
      setOutcome(null);
      setUtterance("");
    } catch {
      setError("Could not reach the server. The change was not applied.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Card>
      <SectionTitle hint={role === "admin" ? "Institution-wide" : "Your courses only"}>
        <span className="inline-flex items-center gap-2">
          <span className="rounded-md bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">
            AI
          </span>
          Command bar
        </span>
      </SectionTitle>

      <p className="mb-3 text-sm text-slate-600">
        Ask a question or describe a change in plain English. Changes are shown to you
        first and are only applied after you confirm them.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(utterance);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={utterance}
          onChange={(e) => setUtterance(e.target.value)}
          placeholder="e.g. Show students below 75% attendance"
          maxLength={300}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <button
          type="submit"
          disabled={planning || !utterance.trim()}
          className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {planning ? "Working…" : "Run"}
        </button>
      </form>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setUtterance(ex);
              run(ex);
            }}
            disabled={planning}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
      </div>

      {planning ? (
        <div className="mt-4 space-y-2" aria-live="polite">
          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      ) : null}

      {done ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          {done} This change was recorded in the audit log.
        </p>
      ) : null}

      {outcome?.kind === "clarify" ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">{outcome.message}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {outcome.options.map((opt) => (
              <span
                key={opt}
                className="rounded-full bg-white px-2.5 py-1 text-xs text-amber-800 ring-1 ring-amber-200"
              >
                {opt}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {outcome?.kind === "answer" ? (
        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-900">{outcome.headline}</p>
          {outcome.rows.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              Nothing matched. Try a different threshold or course.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {outcome.rows.map((r, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                  <span className="text-sm font-medium text-slate-800">{r.label}</span>
                  <span className="text-xs tabular-nums text-slate-600">{r.detail}</span>
                  {r.badge ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                      {r.badge}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-slate-400">Answered by {outcome.model}</p>
        </div>
      ) : null}

      {outcome?.kind === "confirm" ? (
        <div className="mt-4 rounded-xl border-2 border-indigo-300 bg-indigo-50/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">
            Confirm before this is applied
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{outcome.headline}</p>

          <dl className="mt-3 space-y-1.5">
            {outcome.diff.map((d) => {
              const changed = d.from !== d.to;
              return (
                <div key={d.field} className="flex flex-wrap items-baseline gap-2 text-sm">
                  <dt className="w-24 shrink-0 text-xs uppercase tracking-wide text-slate-500">
                    {d.field}
                  </dt>
                  {changed ? (
                    <dd className="flex flex-wrap items-baseline gap-2">
                      <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-800 line-through">
                        {d.from}
                      </span>
                      <span aria-hidden>→</span>
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800">
                        {d.to}
                      </span>
                    </dd>
                  ) : (
                    <dd className="text-slate-700">{d.to}</dd>
                  )}
                </div>
              );
            })}
          </dl>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={applying}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {applying ? "Applying…" : "Apply change"}
            </button>
            <button
              type="button"
              onClick={() => setOutcome(null)}
              disabled={applying}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Planned by {outcome.model}. Nothing has been written yet.
          </p>
        </div>
      ) : null}
    </Card>
  );
}
