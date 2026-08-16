import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="font-mono text-sm font-semibold text-indigo-600">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        The course or page you asked for doesn&apos;t exist, or it isn&apos;t
        available to your account.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Back to home
        </Link>
        <Link
          href="/courses"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Browse courses
        </Link>
      </div>
    </div>
  );
}
