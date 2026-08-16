import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { buildStudentReport } from "@/lib/academics";
import { Empty } from "@/components/ui";
import StudentReportView from "@/components/student-report-view";
import AiInsightPanel from "@/components/ai-insight";
import type { Insight } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TeacherStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("teacher");
  const { id } = await params;
  const supabase = await createClient();

  // RLS limits this to students the signed-in teacher actually teaches, so a
  // guessed id yields nothing rather than another teacher's student.
  const report = await buildStudentReport(supabase, id);

  if (!report) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Empty
          title="Student not found"
          body="Either that student does not exist, or they are not enrolled in any course you teach."
          action={
            <Link href="/teacher" className="text-sm font-semibold text-indigo-600 hover:underline">
              ← Back to your students
            </Link>
          }
        />
      </div>
    );
  }

  const { data: insight } = await supabase
    .from("edu_ai_insights")
    .select("*")
    .eq("student_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <Link href="/teacher" className="text-sm font-medium text-indigo-600 hover:underline">
        ← Your students
      </Link>
      <div className="mt-3">
        <StudentReportView report={report} />
      </div>
      <div className="mt-8">
        <AiInsightPanel
          studentId={id}
          studentName={report.name}
          initial={(insight as Insight) ?? null}
        />
      </div>
    </div>
  );
}
