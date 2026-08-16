import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safe = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "";

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <LoginForm next={safe} />
    </div>
  );
}
