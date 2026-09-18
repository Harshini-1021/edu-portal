import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "./types";

export type AuditEntry = {
  /** Verb, e.g. "attendance.mark" or "marks.save". */
  action: string;
  /** Table or concept the action touched. */
  entity: string;
  entityId?: string | null;
  /** One human-readable sentence — this is what the audit page displays. */
  summary: string;
  detail?: Record<string, unknown>;
  /** Distinguishes a form submission from a natural-language instruction. */
  source?: "ui" | "ai_command";
};

/**
 * Writes one row to the append-only trail.
 *
 * Deliberately best-effort: a failure to log must never fail the user's actual
 * work. A teacher marking attendance in a lecture hall should not lose the
 * register because an audit insert timed out. Failures are reported to the
 * server log and swallowed.
 *
 * The actor is not taken from the caller's arguments by trust alone — the RLS
 * policy on edu_audit_log pins actor_id to auth.uid(), so a forged actor is
 * rejected by the database rather than by this function.
 */
export async function recordAudit(
  supabase: SupabaseClient,
  actor: Profile | null,
  entry: AuditEntry,
): Promise<void> {
  if (!actor) return;

  try {
    const { error } = await supabase.from("edu_audit_log").insert({
      actor_id: actor.id,
      actor_name: actor.full_name,
      actor_role: actor.role,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      summary: entry.summary,
      detail: entry.detail ?? {},
      source: entry.source ?? "ui",
    });
    if (error) {
      console.error("[audit] insert failed", entry.action, error.message);
    }
  } catch (err) {
    console.error("[audit] insert threw", entry.action, err);
  }
}
