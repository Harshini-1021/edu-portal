import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { Card, Empty, SectionTitle, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  entity: string;
  summary: string;
  source: string;
  created_at: string;
};

const SOURCE_STYLE: Record<string, string> = {
  ai_command: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  ui: "bg-slate-100 text-slate-600 ring-slate-200",
};

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  await requireRole("admin");
  const supabase = await createClient();
  const { source } = await searchParams;

  let query = supabase
    .from("edu_audit_log")
    .select("id, actor_name, actor_role, action, entity, summary, source, created_at")
    .order("created_at", { ascending: false })
    .limit(150);

  if (source === "ai_command" || source === "ui") {
    query = query.eq("source", source);
  }

  const { data, error } = await query;
  const rows = (data ?? []) as Row[];

  // The table is created by a migration that may not have been applied yet.
  // Say so plainly rather than rendering an empty page that looks like "no
  // activity has ever happened".
  const missingTable = Boolean(error);

  const aiCount = rows.filter((r) => r.source === "ai_command").length;
  const writes = rows.filter((r) => r.action.includes("execute") || !r.action.includes("query")).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Audit trail
        </h1>
        <Link href="/admin" className="text-sm font-medium text-indigo-600 hover:underline">
          ← Back to dashboard
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Append-only. Every change to an academic record is recorded here with the person
        who made it — including changes made through the AI command bar.
      </p>

      {missingTable ? (
        <div className="mt-6">
          <Empty
            title="The audit table has not been created yet"
            body="Run supabase/migrations/20260918_audit_log.sql against the database. Until then, actions still work but are not recorded."
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Stat label="Recorded events" value={String(rows.length)} sub="Most recent 150" />
            <Stat label="Via AI command bar" value={String(aiCount)} />
            <Stat label="Record changes" value={String(writes)} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { label: "All", value: undefined },
              { label: "AI command bar", value: "ai_command" },
              { label: "Forms", value: "ui" },
            ].map((f) => {
              const active = source === f.value || (!source && !f.value);
              return (
                <Link
                  key={f.label}
                  href={f.value ? `/admin/audit?source=${f.value}` : "/admin/audit"}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                    active
                      ? "bg-slate-900 text-white ring-slate-900"
                      : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-300"
                  }`}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-6">
            <SectionTitle hint="Newest first">Activity</SectionTitle>
            {rows.length === 0 ? (
              <Empty
                title="Nothing recorded yet"
                body="Mark attendance, enter a mark, or run an AI command and it will appear here."
              />
            ) : (
              <Card className="p-0">
                <ul className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3">
                      <span
                        className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
                          SOURCE_STYLE[r.source] ?? SOURCE_STYLE.ui
                        }`}
                      >
                        {r.source === "ai_command" ? "AI" : "Form"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800">{r.summary}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {r.actor_name} · {r.actor_role} · {r.action}
                        </p>
                      </div>
                      <time
                        dateTime={r.created_at}
                        className="shrink-0 text-xs tabular-nums text-slate-400"
                      >
                        {when(r.created_at)}
                      </time>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
