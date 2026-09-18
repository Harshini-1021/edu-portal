import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Database-backed rate limit for AI generation.
 *
 * An in-memory counter is useless here: the app runs on serverless functions,
 * so each instance would keep its own tally and a user could exceed the limit
 * simply by being routed to a cold instance. Counting rows the user actually
 * caused is instance-independent and needs no extra infrastructure.
 *
 * The limit protects two things at once — the Gemini free-tier quota (~15 RPM,
 * shared by every visitor to the live demo) and the cost of the fallback.
 */
export const AI_LIMIT = 8;
export const AI_WINDOW_MINUTES = 10;

export type RateVerdict =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; message: string };

export async function checkAiRateLimit(
  supabase: SupabaseClient,
  actorId: string,
): Promise<RateVerdict> {
  const since = new Date(Date.now() - AI_WINDOW_MINUTES * 60_000).toISOString();

  const { data, error } = await supabase
    .from("edu_ai_insights")
    .select("created_at")
    .eq("generated_by", actorId)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  // A failed count must not lock the user out of the headline feature.
  if (error || !data) return { allowed: true };
  if (data.length < AI_LIMIT) return { allowed: true };

  const oldest = new Date(data[0].created_at).getTime();
  const freeAt = oldest + AI_WINDOW_MINUTES * 60_000;
  const retryAfterSeconds = Math.max(1, Math.ceil((freeAt - Date.now()) / 1000));

  return {
    allowed: false,
    retryAfterSeconds,
    message: `You have generated ${AI_LIMIT} analyses in the last ${AI_WINDOW_MINUTES} minutes. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
  };
}
