import SignupForm from "./signup-form";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <SignupForm />
    </div>
  );
}
