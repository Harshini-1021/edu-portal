"use client";

import { useState } from "react";
import type { Insight } from "@/lib/types";
import { RiskBadge } from "./ui";

type Props = {
  studentId: string;
  studentName?: string;
  initial: Insight | null;
  compact?: boolean;
};

function asList(value: unknown): Record<string, string>[] {
  if (Array.isArray(value)) return value as Record<string, string>[];
  return [];
}

export default function AiInsightPanel({ studentId, studentName, initial, compact }: Props) {
  const [insight, setInsight] = useState<Insight | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function generate() {
    if (loading) return; // a double click must not fire two generations
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/ai/insight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json?.error ?? "The analysis could not be generated.");
        return;
      }
      if (json.insight) setInsight(json.insight as Insight);
      if (json.stale) setNotice(json.error ?? "Showing the last saved analysis.");
      else if (json.reused) setNotice("Showing the analysis generated a moment ago.");
      else if (json.unsaved) setNotice("Analysis generated but could not be saved.");
    } catch {
      setError("Network problem — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const weak = asList(insight?.weak_subjects);
  const recs = asList(insight?.recommendations);

  return (
    <section className="rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50/70 to-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
            <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
              AI
            </span>
            Academic Intelligence
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            {studentName
              ? `Analyses ${studentName}'s attendance, assignment scores and examination marks.`
              : "Analyses your attendance, assignment scores and examination marks to find weak subjects, academic risk and what to do next."}
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Analysing…" : insight ? "Re-analyse" : "Get AI insights"}
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-200"
        >
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
          {notice}
        </p>
      ) : null}

      {loading && !insight ? (
        <div className="mt-5 space-y-3">
          <div className="edu-skeleton h-4 w-1/3 rounded bg-slate-200" />
          <div className="edu-skeleton h-3 w-full rounded bg-slate-200" />
          <div className="edu-skeleton h-3 w-5/6 rounded bg-slate-200" />
          <div className="edu-skeleton h-20 w-full rounded-xl bg-slate-200" />
        </div>
      ) : null}

      {!insight && !loading ? (
        <p className="mt-5 rounded-xl border border-dashed border-indigo-200 bg-white/60 px-4 py-6 text-center text-sm text-slate-500">
          No analysis yet. Generate one to see weak subjects, risk level and
          personalised recommendations drawn from the actual record.
        </p>
      ) : null}

      {insight ? (
        <div className={`edu-fade mt-5 space-y-5 ${loading ? "opacity-60" : ""}`}>
          <div className="flex flex-wrap items-center gap-3">
            <RiskBadge level={insight.risk_level} />
            <span className="text-xs text-slate-500">
              {new Date(insight.created_at).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {" · "}
              <span className="font-mono">{insight.model}</span>
            </span>
          </div>

          <p className="text-sm leading-relaxed text-slate-800">{insight.summary}</p>

          {insight.trend ? (
            <p className="rounded-lg bg-white px-3.5 py-2.5 text-sm italic text-slate-600 ring-1 ring-inset ring-slate-200">
              {insight.trend}
            </p>
          ) : null}

          {weak.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Weak subjects
              </h3>
              <ul className="mt-2 space-y-2">
                {weak.map((w, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-rose-100 bg-rose-50/60 px-3.5 py-2.5"
                  >
                    <p className="text-sm font-semibold text-rose-900">{w.course}</p>
                    <p className="mt-0.5 text-sm text-rose-800/90">{w.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {recs.length > 0 && !compact ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Recommendations
              </h3>
              <ol className="mt-2 space-y-2">
                {recs.map((r, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-3"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{r.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{r.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
