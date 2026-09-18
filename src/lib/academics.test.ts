import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildStudentReport, heuristicRisk, fmtPct } from "./academics";

/**
 * A stub that answers the four queries buildStudentReport makes, in the shape
 * PostgREST actually returns. It is chainable and thenable so the same object
 * serves both `await q.eq(...)` and `await q.eq(...).maybeSingle()`.
 */
function stubClient(tables: Record<string, unknown>): SupabaseClient {
  return {
    from(table: string) {
      const payload = tables[table];
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      Object.assign(chain, {
        select: self,
        eq: self,
        in: self,
        order: self,
        limit: self,
        maybeSingle: async () => ({
          data: Array.isArray(payload) ? (payload[0] ?? null) : (payload ?? null),
          error: null,
        }),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve({ data: payload ?? [], error: null }).then(res, rej),
      });
      return chain;
    },
  } as unknown as SupabaseClient;
}

const STUDENT = {
  id: "s1",
  roll_no: "22CS001",
  class_name: "CSE-A",
  profile_id: "p1",
  edu_profiles: { full_name: "Arun Kumar" },
};

const BASE = {
  edu_students: STUDENT,
  edu_enrollments: [
    {
      course_id: "c1",
      edu_courses: {
        id: "c1",
        code: "CS301",
        title: "Data Structures",
        credits: 4,
        schedule: "Mon 09:00",
        edu_teachers: { full_name: "Prof. Priya" },
      },
    },
    {
      course_id: "c2",
      edu_courses: {
        id: "c2",
        code: "CS302",
        title: "Databases",
        credits: 3,
        schedule: "Tue 11:00",
        edu_teachers: { full_name: "Prof. Priya" },
      },
    },
  ],
  edu_scores: [
    // graded: counts, 60 out of 100
    { score: 60, status: "graded", edu_assessments: { id: "a1", course_id: "c1", max_score: 100, title: "Exam", kind: "exam" } },
    // pending: excluded entirely — a blank must not read as a fail
    { score: null, status: "pending", edu_assessments: { id: "a2", course_id: "c1", max_score: 50, title: "Lab", kind: "assignment" } },
    // missing: counts as zero out of 50
    { score: 0, status: "missing", edu_assessments: { id: "a3", course_id: "c1", max_score: 50, title: "Quiz", kind: "assignment" } },
  ],
  edu_attendance: [
    { course_id: "c1", status: "present" },
    { course_id: "c1", status: "present" },
    { course_id: "c1", status: "late" },
    { course_id: "c1", status: "absent" },
  ],
};

describe("buildStudentReport — grading rules", () => {
  it("excludes pending work from the denominator but counts missing work as zero", async () => {
    const report = await buildStudentReport(stubClient(BASE), "s1");
    const cs301 = report!.courses.find((c) => c.code === "CS301")!;

    // 60 earned; possible = 100 (graded) + 50 (missing). The 50-mark pending
    // lab is excluded, so the score is 60/150, not 60/200 and not 60/100.
    expect(cs301.earned).toBe(60);
    expect(cs301.possible).toBe(150);
    expect(cs301.scorePct).toBe(40);
    expect(cs301.pending).toBe(1);
    expect(cs301.missing).toBe(1);
  });

  it("weights a late mark as half a present mark", async () => {
    const report = await buildStudentReport(stubClient(BASE), "s1");
    const cs301 = report!.courses.find((c) => c.code === "CS301")!;

    // (2 present + 0.5 late) / 4 sessions
    expect(cs301.attendancePct).toBe(62.5);
    expect(cs301.present).toBe(2);
    expect(cs301.late).toBe(1);
    expect(cs301.absent).toBe(1);
  });

  it("returns null rather than NaN for a course with no data at all", async () => {
    const report = await buildStudentReport(stubClient(BASE), "s1");
    const cs302 = report!.courses.find((c) => c.code === "CS302")!;

    expect(cs302.scorePct).toBeNull();
    expect(cs302.attendancePct).toBeNull();
    expect(Number.isNaN(cs302.scorePct as unknown as number)).toBe(false);
  });

  it("returns null overalls for a student with zero enrollments", async () => {
    const report = await buildStudentReport(
      stubClient({ ...BASE, edu_enrollments: [], edu_scores: [], edu_attendance: [] }),
      "s1",
    );
    expect(report!.courses).toEqual([]);
    expect(report!.overallScorePct).toBeNull();
    expect(report!.overallAttendancePct).toBeNull();
  });

  it("returns null when the student is not visible to the caller (RLS yields nothing)", async () => {
    const report = await buildStudentReport(stubClient({ ...BASE, edu_students: null }), "s1");
    expect(report).toBeNull();
  });

  it("sorts courses by code so the dashboard order is stable", async () => {
    const report = await buildStudentReport(stubClient(BASE), "s1");
    expect(report!.courses.map((c) => c.code)).toEqual(["CS301", "CS302"]);
  });
});

describe("heuristicRisk — the deterministic band shown before any AI runs", () => {
  it("reports unknown when there is nothing to judge", () => {
    expect(heuristicRisk(null, null)).toBe("unknown");
  });

  it("flags high risk on a failing score", () => {
    expect(heuristicRisk(45, 90)).toBe("high");
  });

  it("flags high risk on attendance below the 65% floor", () => {
    expect(heuristicRisk(90, 60)).toBe("high");
  });

  it("flags medium risk in the middle band", () => {
    expect(heuristicRisk(65, 85)).toBe("medium");
    expect(heuristicRisk(85, 75)).toBe("medium");
  });

  it("reports low risk for a strong record", () => {
    expect(heuristicRisk(85, 95)).toBe("low");
  });

  it("does not punish a missing half of the record", () => {
    // Only attendance known, and it is good: not high risk on score alone.
    expect(heuristicRisk(null, 95)).toBe("low");
  });
});

describe("fmtPct", () => {
  it("renders an em dash for null instead of '0%' or 'NaN%'", () => {
    expect(fmtPct(null)).toBe("—");
  });

  it("renders a percentage otherwise", () => {
    expect(fmtPct(62.5)).toBe("62.5%");
  });
});
