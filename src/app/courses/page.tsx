import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Empty, Pill } from "@/components/ui";

export const dynamic = "force-dynamic";

type Search = { q?: string; sem?: string; credits?: string };

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  const sem = (params.sem ?? "").trim();
  const credits = (params.credits ?? "").trim();

  const supabase = await createClient();

  let query = supabase
    .from("edu_courses")
    .select("id, code, title, description, credits, schedule, semester, edu_teachers(full_name, department)")
    .order("code");

  if (q) {
    // Escaped so a comma or paren in the search box cannot break the filter.
    const safe = q.replace(/[%,()]/g, " ");
    query = query.or(`code.ilike.%${safe}%,title.ilike.%${safe}%,description.ilike.%${safe}%`);
  }
  if (sem) query = query.eq("semester", sem);
  if (credits && /^\d+$/.test(credits)) query = query.eq("credits", Number(credits));

  const { data: courses, error } = await query;

  const { data: allSemesters } = await supabase.from("edu_courses").select("semester");
  const semesters = Array.from(new Set((allSemesters ?? []).map((s) => s.semester))).sort();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        Course catalogue
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Search by code, title or topic. Filter by semester and credits.
      </p>

      <form className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search courses — try “database” or CS301"
          aria-label="Search courses"
          className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
        <select
          name="sem"
          defaultValue={sem}
          aria-label="Filter by semester"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400"
        >
          <option value="">All semesters</option>
          {semesters.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="credits"
          defaultValue={credits}
          aria-label="Filter by credits"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400"
        >
          <option value="">Any credits</option>
          <option value="3">3 credits</option>
          <option value="4">4 credits</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Search
        </button>
      </form>

      <div className="mt-8">
        {error ? (
          <Empty
            title="Could not load the catalogue"
            body="Something went wrong reaching the database. Refresh the page to try again."
          />
        ) : (courses ?? []).length === 0 ? (
          <Empty
            title="No courses match that search"
            body={
              q || sem || credits
                ? "Try a broader search term, or clear the filters to see everything on offer."
                : "No courses have been published for this semester yet."
            }
            action={
              <Link href="/courses" className="text-sm font-semibold text-indigo-600 hover:underline">
                Clear filters
              </Link>
            }
          />
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-500">
              {courses!.length} course{courses!.length === 1 ? "" : "s"} found
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {courses!.map((c) => {
                const teacher = (c.edu_teachers ?? null) as
                  | { full_name?: string; department?: string }
                  | null;
                return (
                  <Link key={c.id} href={`/courses/${c.code}`} className="block">
                    <Card className="h-full transition hover:border-indigo-300 hover:shadow-md">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-semibold text-indigo-600">{c.code}</p>
                          <h2 className="mt-0.5 truncate font-semibold text-slate-900">{c.title}</h2>
                        </div>
                        <Pill>{c.credits} cr</Pill>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
                        {c.description}
                      </p>
                      <dl className="mt-3 space-y-1 text-xs text-slate-500">
                        <div className="flex gap-2">
                          <dt className="font-medium text-slate-600">Faculty</dt>
                          <dd className="truncate">{teacher?.full_name ?? "Unassigned"}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="font-medium text-slate-600">Schedule</dt>
                          <dd className="truncate">{c.schedule}</dd>
                        </div>
                      </dl>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
