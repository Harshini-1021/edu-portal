import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile, Role } from "./types";

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("edu_profiles")
    .select("id, role, full_name, email, avatar_seed")
    .eq("id", user.id)
    .maybeSingle();

  return (data as Profile) ?? null;
}

const HOME: Record<Role, string> = {
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
};

/**
 * Page-level guard. Middleware already redirects, but pages re-check so a
 * direct render (or a proxy change) can never leak another role's screen.
 */
export async function requireRole(role: Role): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect(`/login?next=${HOME[role]}`);
  if (profile.role !== role) redirect(HOME[profile.role]);
  return profile;
}

export function homeFor(role: Role | undefined): string {
  return role ? HOME[role] : "/login";
}
