"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { assignTeacher, createCourse, enrollStudent, type AdminState } from "./actions";

type Option = { id: string; label: string };

function Result({ state }: { state: AdminState }) {
  if (!state) return null;
  return (
    <p
      role="status"
      className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset ${
        state.ok
          ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
          : "bg-rose-50 text-rose-700 ring-rose-200"
      }`}
    >
      {state.message}
    </p>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

const field =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const label = "block text-xs font-medium text-slate-600";

export function CreateCourseForm({ teachers }: { teachers: Option[] }) {
  const [state, action] = useActionState<AdminState, FormData>(createCourse, null);

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="code" className={label}>
            Course code
          </label>
          <input id="code" name="code" required placeholder="CS306" className={field} />
        </div>
        <div>
          <label htmlFor="credits" className={label}>
            Credits
          </label>
          <input
            id="credits"
            name="credits"
            type="number"
            min={1}
            max={10}
            defaultValue={3}
            className={field}
          />
        </div>
      </div>
      <div>
        <label htmlFor="title" className={label}>
          Title
        </label>
        <input id="title" name="title" required placeholder="Machine Learning" className={field} />
      </div>
      <div>
        <label htmlFor="description" className={label}>
          Description
        </label>
        <textarea id="description" name="description" rows={2} className={field} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="schedule" className={label}>
            Schedule
          </label>
          <input id="schedule" name="schedule" placeholder="Mon & Wed, 09:00 - 10:30" className={field} />
        </div>
        <div>
          <label htmlFor="teacher_id" className={label}>
            Faculty
          </label>
          <select id="teacher_id" name="teacher_id" className={field} defaultValue="">
            <option value="">Unassigned</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Result state={state} />
      <Submit label="Create course" />
    </form>
  );
}

export function EnrollForm({
  students,
  courses,
}: {
  students: Option[];
  courses: Option[];
}) {
  const [state, action] = useActionState<AdminState, FormData>(enrollStudent, null);

  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="student_id" className={label}>
          Student
        </label>
        <select id="student_id" name="student_id" required className={field} defaultValue="">
          <option value="" disabled>
            Select a student
          </option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="enroll_course" className={label}>
          Course
        </label>
        <select id="enroll_course" name="course_id" required className={field} defaultValue="">
          <option value="" disabled>
            Select a course
          </option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <Result state={state} />
      <Submit label="Enroll student" />
    </form>
  );
}

export function AssignTeacherForm({
  courses,
  teachers,
}: {
  courses: Option[];
  teachers: Option[];
}) {
  const [state, action] = useActionState<AdminState, FormData>(assignTeacher, null);

  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="assign_course" className={label}>
          Course
        </label>
        <select id="assign_course" name="course_id" required className={field} defaultValue="">
          <option value="" disabled>
            Select a course
          </option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="assign_teacher" className={label}>
          Assign to
        </label>
        <select id="assign_teacher" name="teacher_id" className={field} defaultValue="">
          <option value="">Unassigned</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <Result state={state} />
      <Submit label="Reassign course" />
    </form>
  );
}
