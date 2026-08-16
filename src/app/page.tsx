import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile, homeFor } from "@/lib/auth";
import { ButtonLink, Card, Pill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const profile = await getProfile();

  const [{ data: courses }, { count: studentCount }, { data: teachers }] =
    await Promise.all([
      supabase
        .from("edu_courses")
        .select("id, code, title, description, credits, schedule, edu_teachers(full_name)")
        .order("code")
        .limit(3),
      supabase.from("edu_students").select("id", { count: "exact", head: true }),
      supabase.from("edu_teachers").select("id, full_name, department, designation").limit(4),
    ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
      <section className="edu-fade">
        <Pill>Web Development × Integrated AI</Pill>
        <h1 className="mt-4 max-w-3xl text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
          One portal for courses, attendance, examinations —{" "}
          <span className="text-indigo-600">and an AI that reads the record.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
          EduManage keeps the whole academic record in one place for students,
          teachers and administrators. On top of it, an AI layer analyses real
          attendance, assignment scores and examination marks to flag weak
          subjects, surface academic risk and generate personalised
          recommendations.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          {profile ? (
            <ButtonLink href={homeFor(profile.role)}>Go to your dashboard</ButtonLink>
          ) : (
            <ButtonLink href="/login">Sign in to your dashboard</ButtonLink>
          )}
          <ButtonLink href="/courses" variant="ghost">
            Browse the course catalogue
          </ButtonLink>
        </div>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Students",
            body: "Courses, attendance percentage, assignment and exam marks, progress per subject, and an AI improvement plan built from your own record.",
          },
          {
            title: "Teachers",
            body: "Mark attendance in one tap per student, enter and edit marks, and see which of your students are drifting into academic risk.",
          },
          {
            title: "Administrators",
            body: "Manage students, teachers, courses and enrollments, with an institution-wide AI risk roll-up across every class.",
          },
        ].map((item) => (
          <Card key={item.title}>
            <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
          </Card>
        ))}
      </section>

      <section className="mt-12">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Courses on offer
          </h2>
          <Link href="/courses" className="text-sm font-medium text-indigo-600 hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {(courses ?? []).map((c) => {
            const teacher = (c.edu_teachers ?? null) as { full_name?: string } | null;
            return (
              <Link key={c.id} href={`/courses/${c.code}`} className="block">
                <Card className="h-full transition hover:border-indigo-300 hover:shadow-md">
                  <p className="font-mono text-xs font-semibold text-indigo-600">{c.code}</p>
                  <h3 className="mt-1 font-semibold text-slate-900">{c.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{c.description}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    {teacher?.full_name ?? "Unassigned"} · {c.credits} credits
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">Faculty</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(teachers ?? []).map((t) => (
            <Card key={t.id}>
              <p className="font-semibold text-slate-900">{t.full_name}</p>
              <p className="mt-1 text-sm text-slate-600">{t.designation}</p>
              <p className="text-xs text-slate-500">{t.department}</p>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-500">
          {studentCount ?? 0} students enrolled across {(courses ?? []).length > 0 ? "the" : "no"}{" "}
          current semester.
        </p>
      </section>
    </div>
  );
}
