import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { homeFor } from "@/lib/auth";
import { signOut } from "@/app/actions";

export default async function Nav() {
  const profile = await getProfile();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            EM
          </span>
          <span className="hidden text-slate-900 sm:inline">EduManage</span>
        </Link>

        <Link
          href="/courses"
          className="ml-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          Courses
        </Link>

        {profile ? (
          <Link
            href={homeFor(profile.role)}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            Dashboard
          </Link>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {profile ? (
            <>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium leading-tight text-slate-900">
                  {profile.full_name}
                </p>
                <p className="text-xs capitalize leading-tight text-slate-500">{profile.role}</p>
              </div>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                {profile.full_name.slice(0, 1).toUpperCase()}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
