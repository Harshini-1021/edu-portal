import { z } from "zod";

/**
 * Every input that crosses a trust boundary is parsed here, in one place:
 * form submissions from the browser, JSON bodies on route handlers, and the
 * JSON a language model hands back. Nothing reaches the database until it has
 * been through one of these schemas.
 *
 * Keeping them in a single module means the validation rules are reviewable on
 * their own, and the error messages a user sees are written next to the rule
 * that produced them rather than scattered through action code.
 */

export const uuid = z.uuid("That record reference is not valid.");

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.");

/** A session cannot be recorded before it has happened. */
export const pastOrToday = isoDate.refine(
  (value) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return new Date(value) <= end;
  },
  { message: "Attendance cannot be recorded for a future date." },
);

export const roleSchema = z.enum(["admin", "teacher", "student"]);
export const attendanceStatus = z.enum(["present", "absent", "late"]);
export const riskLevel = z.enum(["low", "medium", "high"]);

/* -------------------------------------------------------------------------- */
/* Route handler bodies                                                        */
/* -------------------------------------------------------------------------- */

export const insightRequest = z.object({
  studentId: uuid,
});

/* -------------------------------------------------------------------------- */
/* Teacher actions                                                             */
/* -------------------------------------------------------------------------- */

export const markAttendanceInput = z.object({
  courseId: uuid,
  sessionDate: pastOrToday,
  entries: z
    .array(z.object({ studentId: uuid, status: attendanceStatus }))
    .min(1, "No students to record."),
});

/**
 * A mark box holds one of three things, and the difference matters:
 * blank means "not evaluated yet", "a"/"absent" means a missed submission that
 * counts as zero, and a number is a grade. A blank must never read as a fail.
 */
export const markCell = z.union([
  z.literal("").transform(() => ({ kind: "pending" as const })),
  z
    .string()
    .regex(/^(a|absent)$/i)
    .transform(() => ({ kind: "missing" as const })),
  z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Use a number, or leave it blank.")
    .transform((raw) => ({ kind: "graded" as const, score: Number(raw) })),
]);

/** Built per assessment, because the ceiling comes from the database row. */
export function gradedScore(maxScore: number, assessmentTitle: string) {
  return z
    .number()
    .min(0, "Marks cannot be negative.")
    .max(maxScore, `Marks cannot exceed ${maxScore} for “${assessmentTitle}”.`);
}

export const saveMarksInput = z.object({
  assessmentId: uuid,
});

/* -------------------------------------------------------------------------- */
/* Admin actions                                                               */
/* -------------------------------------------------------------------------- */

/** "" from an unselected <select> means "no teacher", not an invalid id. */
const optionalUuid = z
  .union([uuid, z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : null));

export const createCourseInput = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,4}\d{3}$/, "Course code must look like CS301 or MA201."),
  title: z
    .string()
    .trim()
    .min(3, "Give the course a title between 3 and 120 characters.")
    .max(120, "Give the course a title between 3 and 120 characters."),
  description: z.string().trim().max(1000).optional().default(""),
  schedule: z.string().trim().max(120).optional().default("TBD"),
  credits: z.coerce
    .number()
    .int("Credits must be a whole number between 1 and 10.")
    .min(1, "Credits must be a whole number between 1 and 10.")
    .max(10, "Credits must be a whole number between 1 and 10."),
  teacherId: optionalUuid,
});

export const enrollStudentInput = z.object({
  studentId: uuid,
  courseId: uuid,
});

export const assignTeacherInput = z.object({
  courseId: uuid,
  teacherId: optionalUuid,
});

/* -------------------------------------------------------------------------- */
/* Model output                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The contract the model must satisfy before anything it produced is shown to a
 * user or written to the database. `.catch()` degrades a bad field to a safe
 * default instead of discarding an otherwise usable analysis; the fields that
 * carry the actual meaning (summary, recommendations) have no fallback, so a
 * response without them fails outright and the caller falls back to the other
 * provider rather than rendering an empty card.
 */
export const aiInsightSchema = z.object({
  risk_level: riskLevel.catch("medium"),
  summary: z
    .string()
    .trim()
    .min(1, "The model returned no summary.")
    .transform((v) => v.slice(0, 800)),
  trend: z
    .string()
    .trim()
    .catch("")
    .transform((v) => v.slice(0, 800)),
  weak_subjects: z
    .array(
      z.object({
        course: z.string().trim().min(1).transform((v) => v.slice(0, 200)),
        reason: z.string().trim().catch("").transform((v) => v.slice(0, 500)),
      }),
    )
    .catch([])
    .transform((list) => list.slice(0, 6)),
  recommendations: z
    .array(
      z.object({
        title: z.string().trim().min(1).transform((v) => v.slice(0, 200)),
        detail: z.string().trim().catch("").transform((v) => v.slice(0, 800)),
      }),
    )
    .min(1, "The model returned no recommendations.")
    .transform((list) => list.slice(0, 6)),
});

export type AiInsightPayload = z.infer<typeof aiInsightSchema>;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Collapses a ZodError into the single sentence a form can display. The first
 * issue is the one the user should fix first, so it is the one shown.
 */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "That input is not valid.";
}

/** Parses, returning either the typed value or a message ready for the UI. */
export function parseOrMessage<T extends z.ZodType>(
  schema: T,
  input: unknown,
): { ok: true; data: z.infer<T> } | { ok: false; message: string } {
  const result = schema.safeParse(input);
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, message: firstIssue(result.error) };
}

/* -------------------------------------------------------------------------- */
/* AI command bar                                                              */
/* -------------------------------------------------------------------------- */

export const commandRequest = z.object({
  utterance: z
    .string()
    .trim()
    .min(3, "Say what you would like to do.")
    .max(300, "That instruction is too long — try a shorter one."),
});

/**
 * What the model is allowed to propose. This is the security boundary of the
 * command bar: the model never sees a credential, never touches the database,
 * and cannot invent an operation. It returns one of these shapes or nothing,
 * and the server resolves the names to ids itself under the caller's own RLS.
 *
 * A plan is a *proposal*. Nothing in this union is executed on the strength of
 * the model's say-so — read actions run immediately because they can only ever
 * return rows the caller is already allowed to see, and the single write action
 * is previewed and must be confirmed by the user before it runs.
 */
export const commandPlan = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("find_students"),
    maxAttendancePct: z.number().min(0).max(100).nullish(),
    maxScorePct: z.number().min(0).max(100).nullish(),
    courseCode: z.string().trim().max(20).nullish(),
    className: z.string().trim().max(40).nullish(),
  }),
  z.object({
    action: z.literal("student_performance"),
    studentName: z.string().trim().min(1).max(80),
  }),
  z.object({
    action: z.literal("update_mark"),
    studentName: z.string().trim().min(1).max(80),
    courseCode: z.string().trim().min(2).max(20),
    assessmentTitle: z.string().trim().max(120).nullish(),
    newScore: z.number().min(0),
  }),
  z.object({
    action: z.literal("unsupported"),
    reason: z.string().trim().max(300).catch("That instruction is not supported."),
  }),
]);

export type CommandPlan = z.infer<typeof commandPlan>;

/** The confirmed write the browser sends back. Re-validated, never trusted. */
export const confirmWrite = z.object({
  studentId: uuid,
  assessmentId: uuid,
  newScore: z.number().min(0),
  utterance: z.string().trim().max(300),
});
