import { describe, it, expect } from "vitest";
import {
  markCell,
  gradedScore,
  createCourseInput,
  pastOrToday,
  insightRequest,
  aiInsightSchema,
  assignTeacherInput,
} from "./schemas";

const UUID_A = "11111111-2222-4333-8444-555555555555";

describe("markCell — the three meanings of a mark box", () => {
  it("treats a blank box as not-yet-evaluated, never as a zero", () => {
    const result = markCell.parse("");
    expect(result).toEqual({ kind: "pending" });
  });

  it("treats 'a' and 'absent' as a missed submission worth zero", () => {
    expect(markCell.parse("a")).toEqual({ kind: "missing" });
    expect(markCell.parse("ABSENT")).toEqual({ kind: "missing" });
  });

  it("reads a number as a grade, including decimals", () => {
    expect(markCell.parse("42")).toEqual({ kind: "graded", score: 42 });
    expect(markCell.parse("17.5")).toEqual({ kind: "graded", score: 17.5 });
  });

  it("rejects text that is neither a number nor an absence marker", () => {
    expect(markCell.safeParse("good").success).toBe(false);
    expect(markCell.safeParse("-5").success).toBe(false);
  });
});

describe("gradedScore — the ceiling comes from the assessment row", () => {
  const ceiling = gradedScore(40, "Midterm");

  it("accepts a mark at the ceiling", () => {
    expect(ceiling.parse(40)).toBe(40);
  });

  it("rejects a mark above the ceiling and names the assessment", () => {
    const result = ceiling.safeParse(41);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("40");
      expect(result.error.issues[0].message).toContain("Midterm");
    }
  });

  it("rejects a negative mark", () => {
    expect(ceiling.safeParse(-1).success).toBe(false);
  });
});

describe("pastOrToday — attendance cannot be recorded ahead of time", () => {
  it("accepts today", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(pastOrToday.safeParse(today).success).toBe(true);
  });

  it("accepts a past date", () => {
    expect(pastOrToday.safeParse("2020-01-15").success).toBe(true);
  });

  it("rejects a future date", () => {
    const future = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    expect(pastOrToday.safeParse(future).success).toBe(false);
  });

  it("rejects a malformed date", () => {
    expect(pastOrToday.safeParse("15/01/2020").success).toBe(false);
  });
});

describe("createCourseInput", () => {
  const valid = {
    code: "cs301",
    title: "Data Structures",
    description: "",
    schedule: "Mon 09:00",
    credits: "4",
    teacherId: "",
  };

  it("upper-cases the course code", () => {
    expect(createCourseInput.parse(valid).code).toBe("CS301");
  });

  it("coerces credits from the form's string to a number", () => {
    expect(createCourseInput.parse(valid).credits).toBe(4);
  });

  it("turns an unselected teacher dropdown into null, not an invalid id", () => {
    expect(createCourseInput.parse(valid).teacherId).toBeNull();
  });

  it("rejects a code that is not in the institutional format", () => {
    expect(createCourseInput.safeParse({ ...valid, code: "DATASTRUCT" }).success).toBe(false);
  });

  it("rejects credits outside 1..10", () => {
    expect(createCourseInput.safeParse({ ...valid, credits: "0" }).success).toBe(false);
    expect(createCourseInput.safeParse({ ...valid, credits: "11" }).success).toBe(false);
  });

  it("rejects a title that is too short to be meaningful", () => {
    expect(createCourseInput.safeParse({ ...valid, title: "DS" }).success).toBe(false);
  });
});

describe("assignTeacherInput", () => {
  it("allows clearing a course's teacher with an empty selection", () => {
    const parsed = assignTeacherInput.parse({ courseId: UUID_A, teacherId: "" });
    expect(parsed.teacherId).toBeNull();
  });

  it("rejects a course id that is not a uuid", () => {
    expect(assignTeacherInput.safeParse({ courseId: "42", teacherId: "" }).success).toBe(false);
  });
});

describe("insightRequest", () => {
  it("accepts a uuid", () => {
    expect(insightRequest.safeParse({ studentId: UUID_A }).success).toBe(true);
  });

  it("rejects a non-uuid, which is what blocks id-guessing at the edge", () => {
    expect(insightRequest.safeParse({ studentId: "1 OR 1=1" }).success).toBe(false);
    expect(insightRequest.safeParse({}).success).toBe(false);
  });
});

describe("aiInsightSchema — the contract the model must satisfy", () => {
  const good = {
    risk_level: "high",
    summary: "Attendance is low across three courses.",
    trend: "Declining since the midterm.",
    weak_subjects: [{ course: "MA201", reason: "12.5% score" }],
    recommendations: [{ title: "Submit MA201 work", detail: "Contact the faculty this week." }],
  };

  it("accepts a well-formed analysis", () => {
    expect(aiInsightSchema.parse(good).risk_level).toBe("high");
  });

  it("degrades an unknown risk level to medium rather than failing the whole analysis", () => {
    const parsed = aiInsightSchema.parse({ ...good, risk_level: "catastrophic" });
    expect(parsed.risk_level).toBe("medium");
  });

  it("degrades malformed weak_subjects to an empty list", () => {
    const parsed = aiInsightSchema.parse({ ...good, weak_subjects: "MA201 is weak" });
    expect(parsed.weak_subjects).toEqual([]);
  });

  it("fails when the summary is missing, so no empty card is ever rendered", () => {
    const { summary: _drop, ...noSummary } = good;
    expect(aiInsightSchema.safeParse(noSummary).success).toBe(false);
  });

  it("fails when there are no recommendations, which triggers the provider fallback", () => {
    expect(aiInsightSchema.safeParse({ ...good, recommendations: [] }).success).toBe(false);
  });

  it("caps runaway output instead of writing an unbounded blob to the database", () => {
    const parsed = aiInsightSchema.parse({
      ...good,
      recommendations: Array.from({ length: 20 }, () => ({ title: "x", detail: "y" })),
    });
    expect(parsed.recommendations.length).toBeLessThanOrEqual(6);
  });
});
