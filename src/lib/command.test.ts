import { describe, it, expect } from "vitest";
import { norm, matchStudents, matchCourse, type StudentRef, type CourseRef } from "./command";
import { commandPlan, confirmWrite } from "./schemas";

const STUDENTS: StudentRef[] = [
  { id: "1", name: "Arun Kumar", rollNo: "22CS001", className: "CSE-A" },
  { id: "2", name: "Arundhati Rao", rollNo: "22CS007", className: "CSE-B" },
  { id: "3", name: "Divya Menon", rollNo: "22CS002", className: "CSE-A" },
];

const COURSES: CourseRef[] = [
  { id: "c1", code: "CS301", title: "Data Structures & Algorithms" },
  { id: "c2", code: "CS303", title: "Operating Systems" },
  { id: "c3", code: "MA201", title: "Discrete Mathematics" },
];

describe("norm", () => {
  it("ignores case, spacing and punctuation so 'CS 301' matches 'cs301'", () => {
    expect(norm("CS 301")).toBe("cs301");
    expect(norm("Operating-Systems")).toBe("operatingsystems");
  });
});

describe("matchStudents", () => {
  it("prefers an exact name match over a prefix match", () => {
    // "Arun" is a prefix of "Arundhati", but an exact hit must win outright so
    // a command naming a real student is never ambiguous against a longer name.
    const hits = matchStudents(STUDENTS, "Arun Kumar");
    expect(hits).toHaveLength(1);
    expect(hits[0].rollNo).toBe("22CS001");
  });

  it("resolves by roll number", () => {
    const hits = matchStudents(STUDENTS, "22CS002");
    expect(hits).toHaveLength(1);
    expect(hits[0].name).toBe("Divya Menon");
  });

  it("returns every candidate for an ambiguous first name, so the user is asked", () => {
    const hits = matchStudents(STUDENTS, "Arun");
    expect(hits.length).toBeGreaterThan(1);
  });

  it("returns nothing for an unknown name rather than guessing the closest one", () => {
    expect(matchStudents(STUDENTS, "Zubair")).toEqual([]);
  });

  it("returns nothing for an empty query", () => {
    expect(matchStudents(STUDENTS, "   ")).toEqual([]);
  });
});

describe("matchCourse", () => {
  it("resolves an exact course code", () => {
    expect(matchCourse(COURSES, "CS301")).toHaveLength(1);
  });

  it("resolves a spoken subject name to its code", () => {
    const hits = matchCourse(COURSES, "operating systems");
    expect(hits).toHaveLength(1);
    expect(hits[0].code).toBe("CS303");
  });

  it("returns nothing for an unknown subject", () => {
    expect(matchCourse(COURSES, "quantum mechanics")).toEqual([]);
  });
});

describe("commandPlan — the boundary on what the model may propose", () => {
  it("accepts a find_students plan", () => {
    const parsed = commandPlan.safeParse({
      action: "find_students",
      maxAttendancePct: 75,
      maxScorePct: null,
      courseCode: null,
      className: "AIML",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts an update_mark plan", () => {
    const parsed = commandPlan.safeParse({
      action: "update_mark",
      studentName: "Arun Kumar",
      courseCode: "MA201",
      assessmentTitle: "Midterm",
      newScore: 92,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an action the model invented", () => {
    // The union is the allow-list. A model that decides to delete a student
    // produces a plan that simply does not parse, so nothing downstream runs.
    expect(
      commandPlan.safeParse({ action: "delete_student", studentName: "Arun Kumar" }).success,
    ).toBe(false);
    expect(
      commandPlan.safeParse({ action: "change_role", studentName: "Arun", role: "admin" }).success,
    ).toBe(false);
  });

  it("rejects an out-of-range percentage filter", () => {
    expect(
      commandPlan.safeParse({ action: "find_students", maxAttendancePct: 900 }).success,
    ).toBe(false);
  });

  it("rejects a negative mark", () => {
    expect(
      commandPlan.safeParse({
        action: "update_mark",
        studentName: "Arun",
        courseCode: "MA201",
        newScore: -10,
      }).success,
    ).toBe(false);
  });
});

describe("confirmWrite — what the browser may send back", () => {
  const good = {
    studentId: "11111111-2222-4333-8444-555555555555",
    assessmentId: "66666666-7777-4888-8999-000000000000",
    newScore: 92,
    utterance: "set Arun's midterm to 92",
  };

  it("accepts a well-formed confirmation", () => {
    expect(confirmWrite.safeParse(good).success).toBe(true);
  });

  it("rejects non-uuid ids, so a crafted request cannot target an arbitrary row", () => {
    expect(confirmWrite.safeParse({ ...good, studentId: "1" }).success).toBe(false);
  });

  it("rejects a negative score even if the browser sends one", () => {
    expect(confirmWrite.safeParse({ ...good, newScore: -5 }).success).toBe(false);
  });
});
