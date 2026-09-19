export type Role = "admin" | "teacher" | "student";
export type AssessmentKind = "assignment" | "exam";
export type ScoreStatus = "pending" | "submitted" | "graded" | "missing";
export type AttendanceStatus = "present" | "absent" | "late";
export type RiskLevel = "low" | "medium" | "high";

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  email: string;
  avatar_seed: string;
};

export type Course = {
  id: string;
  code: string;
  title: string;
  description: string;
  credits: number;
  schedule: string;
  semester: string;
  teacher_id: string | null;
};

export type Insight = {
  id: string;
  student_id: string;
  risk_level: RiskLevel;
  summary: string;
  weak_subjects: { course: string; reason: string }[];
  recommendations: { title: string; detail: string }[];
  trend: string;
  model: string;
  created_at: string;
};

/** Per-course rollup for one student. */
export type CourseReport = {
  courseId: string;
  code: string;
  title: string;
  credits: number;
  schedule: string;
  teacher: string;
  /** null when nothing has been graded yet — render as "—", never NaN. */
  scorePct: number | null;
  earned: number;
  possible: number;
  graded: number;
  pending: number;
  /** Marks still available from assessments that have not been evaluated. */
  pendingMax: number;
  missing: number;
  /** null when no session has been recorded — render as "—". */
  attendancePct: number | null;
  present: number;
  late: number;
  absent: number;
  sessions: number;
};

export type StudentReport = {
  studentId: string;
  name: string;
  rollNo: string;
  className: string;
  courses: CourseReport[];
  overallScorePct: number | null;
  overallAttendancePct: number | null;
};
