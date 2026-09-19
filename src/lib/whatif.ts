/**
 * Deterministic "what if" projections.
 *
 * Every number here is arithmetic, not a model output. A student asking "can I
 * still pass?" deserves an answer that is either right or honestly impossible,
 * never a plausible-sounding guess — so this module deliberately contains no
 * AI call. The AI explains these numbers elsewhere; it does not produce them.
 *
 * Grading rules match academics.ts exactly: graded work counts, missing work
 * counts as zero, pending work is excluded, and a late mark is half a present.
 */

export type MarksProjection =
  | { kind: "already_there"; currentPct: number }
  | { kind: "reachable"; needed: number; outOf: number; neededPct: number; currentPct: number }
  | { kind: "impossible"; bestPossiblePct: number; currentPct: number }
  | { kind: "no_remaining"; currentPct: number }
  | { kind: "no_data" };

/**
 * What a student must score across their remaining assessments to finish at
 * `targetPct` overall.
 *
 * `remainingMax` is the total marks still available — pending assessments that
 * have not been evaluated. Missing work is already counted as zero against
 * `possible` and cannot be recovered, which is exactly why it is worth showing.
 */
export function marksNeeded(
  earned: number,
  possible: number,
  remainingMax: number,
  targetPct: number,
): MarksProjection {
  if (possible <= 0 && remainingMax <= 0) return { kind: "no_data" };

  const currentPct = possible > 0 ? Math.round((earned / possible) * 1000) / 10 : 0;

  if (remainingMax <= 0) {
    return currentPct >= targetPct
      ? { kind: "already_there", currentPct }
      : { kind: "no_remaining", currentPct };
  }

  const finalTotal = possible + remainingMax;
  // Marks required in total to land on the target once everything is graded.
  const requiredTotal = (targetPct / 100) * finalTotal;
  const needed = Math.ceil((requiredTotal - earned) * 10) / 10;

  if (needed <= 0) return { kind: "already_there", currentPct };

  if (needed > remainingMax) {
    const bestPossiblePct = Math.round(((earned + remainingMax) / finalTotal) * 1000) / 10;
    return { kind: "impossible", bestPossiblePct, currentPct };
  }

  return {
    kind: "reachable",
    needed,
    outOf: remainingMax,
    neededPct: Math.round((needed / remainingMax) * 1000) / 10,
    currentPct,
  };
}

export type AttendanceProjection =
  | { kind: "no_data" }
  | { kind: "safe"; currentPct: number; canMiss: number }
  | { kind: "at_risk"; currentPct: number; mustAttend: number }
  | { kind: "unrecoverable"; currentPct: number };

/**
 * How much slack a student has against an attendance requirement.
 *
 * Above the line, answers "how many more sessions can I miss?". Below it,
 * answers "how many in a row must I attend to get back?" — the more useful
 * question, and the one a raw percentage never answers.
 *
 * `cap` bounds the search for the recovery case so a hopeless record returns
 * "unrecoverable" instead of a number no one can act on.
 */
export function absenceBuffer(
  present: number,
  late: number,
  absent: number,
  thresholdPct = 75,
  cap = 60,
): AttendanceProjection {
  const sessions = present + late + absent;
  if (sessions <= 0) return { kind: "no_data" };

  const weighted = present + late * 0.5;
  const currentPct = Math.round((weighted / sessions) * 1000) / 10;
  const threshold = thresholdPct / 100;

  if (currentPct >= thresholdPct) {
    // Largest n where weighted / (sessions + n) still clears the threshold.
    let canMiss = 0;
    while (weighted / (sessions + canMiss + 1) >= threshold && canMiss < cap) {
      canMiss += 1;
    }
    return { kind: "safe", currentPct, canMiss };
  }

  // Smallest n where (weighted + n) / (sessions + n) clears the threshold.
  for (let n = 1; n <= cap; n += 1) {
    if ((weighted + n) / (sessions + n) >= threshold) {
      return { kind: "at_risk", currentPct, mustAttend: n };
    }
  }
  return { kind: "unrecoverable", currentPct };
}

/** Phrases a projection for the UI, so wording lives next to the maths. */
export function describeMarks(p: MarksProjection, target: number): string {
  switch (p.kind) {
    case "no_data":
      return "No graded or pending work on record yet.";
    case "already_there":
      return `Already at ${p.currentPct}% — above the ${target}% target.`;
    case "no_remaining":
      return `All work is graded at ${p.currentPct}%. There is nothing left to change it.`;
    case "impossible":
      return `Out of reach: even full marks on everything remaining finishes at ${p.bestPossiblePct}%.`;
    case "reachable":
      return `Score ${p.needed} of the ${p.outOf} marks still available (${p.neededPct}%) to finish at ${target}%.`;
  }
}

export function describeAttendance(p: AttendanceProjection, threshold: number): string {
  switch (p.kind) {
    case "no_data":
      return "No sessions recorded yet.";
    case "safe":
      return p.canMiss === 0
        ? `At ${p.currentPct}% — on the line. Missing even one more session drops below ${threshold}%.`
        : `At ${p.currentPct}% — can miss ${p.canMiss} more session${p.canMiss === 1 ? "" : "s"} and stay above ${threshold}%.`;
    case "at_risk":
      return `At ${p.currentPct}% — attend the next ${p.mustAttend} session${p.mustAttend === 1 ? "" : "s"} to get back above ${threshold}%.`;
    case "unrecoverable":
      return `At ${p.currentPct}% — cannot reach ${threshold}% within this semester's remaining sessions.`;
  }
}
