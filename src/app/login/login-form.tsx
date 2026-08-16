"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { signIn, type AuthState } from "./actions";

const DEMO = [
  { role: "Administrator", email: "admin@kitedu.in", password: "Admin@2026" },
  { role: "Teacher", email: "priya@kitedu.in", password: "Teacher@2026" },
  { role: "Student (at risk)", email: "arun@kitedu.in", password: "Student@2026" },
  { role: "Student (top)", email: "divya@kitedu.in", password: "Student@2026" },
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<AuthState, FormData>(signIn, { error: null });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">
          Use your institution email. Your role decides which dashboard opens.
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@kitedu.in"
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {state.error ? (
            <p
              role="alert"
              className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-200"
            >
              {state.error}
            </p>
          ) : null}

          <Submit />
        </form>

        <p className="mt-4 text-sm text-slate-600">
          New student?{" "}
          <Link href="/signup" className="font-semibold text-indigo-600 hover:underline">
            Create an account
          </Link>
        </p>
      </div>

      <aside className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Demo accounts</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Throwaway accounts on demo data, published on purpose so a judge can
          walk every role. Tap one to fill the form.
        </p>
        <ul className="mt-4 space-y-2">
          {DEMO.map((d) => (
            <li key={d.email}>
              <button
                type="button"
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.password);
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left transition hover:border-indigo-300 hover:bg-indigo-50/50"
              >
                <span className="block text-sm font-semibold text-slate-800">{d.role}</span>
                <span className="block truncate font-mono text-xs text-slate-500">{d.email}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
