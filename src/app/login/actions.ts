"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOME: Record<string, string> = {
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
};

function safeNext(next: unknown): string | null {
  // Only same-origin relative paths, so ?next= can never be an open redirect.
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!EMAIL.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    // Deliberately generic: never reveals whether the account exists.
    return { error: "Invalid email or password." };
  }

  const { data: profile } = await supabase
    .from("edu_profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  const destination = next ?? HOME[profile?.role ?? "student"] ?? "/student";
  revalidatePath("/", "layout");
  redirect(destination);
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (fullName.length < 2 || fullName.length > 120) {
    return { error: "Enter your full name." };
  }
  if (!EMAIL.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { error: "Choose a password of at least 8 characters." };
  }

  const supabase = await createClient();
  // Role is never read from this form. A database trigger assigns 'student'.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return {
      error:
        error.message.toLowerCase().includes("registered") ||
        error.message.toLowerCase().includes("exists")
          ? "An account with that email already exists. Try signing in."
          : "Could not create the account. Please try again.",
    };
  }

  if (!data.session) {
    return {
      error:
        "Account created. Email confirmation is required before you can sign in — ask an administrator to confirm it.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/student");
}
