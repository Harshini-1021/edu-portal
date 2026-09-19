import { describe, it, expect } from "vitest";
import { marksNeeded, absenceBuffer } from "./whatif";

describe("marksNeeded", () => {
  it("says already there when the target is met and nothing is pending", () => {
    const p = marksNeeded(80, 100, 0, 75);
    expect(p.kind).toBe("already_there");
  });

  it("computes the marks required across remaining assessments", () => {
    // 40/100 so far, 100 marks still to come, target 60% of the 200 total
    // => needs 120 total => 80 more.
    const p = marksNeeded(40, 100, 100, 60);
    expect(p.kind).toBe("reachable");
    if (p.kind === "reachable") {
      expect(p.needed).toBe(80);
      expect(p.outOf).toBe(100);
      expect(p.neededPct).toBe(80);
    }
  });

  it("reports impossible when full marks on everything left still falls short", () => {
    // 10/100 with only 20 marks left: best case is 30/120 = 25%.
    const p = marksNeeded(10, 100, 20, 60);
    expect(p.kind).toBe("impossible");
    if (p.kind === "impossible") expect(p.bestPossiblePct).toBe(25);
  });

  it("does not pretend a finished record can still change", () => {
    const p = marksNeeded(40, 100, 0, 75);
    expect(p.kind).toBe("no_remaining");
  });

  it("reports no data rather than dividing by zero", () => {
    expect(marksNeeded(0, 0, 0, 75).kind).toBe("no_data");
  });

  it("treats a target already exceeded on projection as already there", () => {
    // 90/100 with 100 to come, target 50%: even zero more marks clears it.
    const p = marksNeeded(90, 100, 100, 40);
    expect(p.kind).toBe("already_there");
  });

  it("rounds the requirement up, never down", () => {
    // Needing 50.1 marks must not be reported as 50.
    const p = marksNeeded(0, 0, 100, 50.05);
    if (p.kind === "reachable") expect(p.needed).toBeGreaterThanOrEqual(50);
  });
});

describe("absenceBuffer", () => {
  it("counts how many sessions can still be missed", () => {
    // 9 present of 10 = 90%. Missing 2 more gives 9/12 = 75%, still at the line.
    const p = absenceBuffer(9, 0, 1, 75);
    expect(p.kind).toBe("safe");
    if (p.kind === "safe") expect(p.canMiss).toBe(2);
  });

  it("reports zero slack for a student exactly on the line", () => {
    const p = absenceBuffer(3, 0, 1, 75); // 3/4 = 75%
    expect(p.kind).toBe("safe");
    if (p.kind === "safe") expect(p.canMiss).toBe(0);
  });

  it("weights a late mark as half a present", () => {
    // 2 present + 1 late = 2.5 of 4 = 62.5%, below the line.
    const p = absenceBuffer(2, 1, 1, 75);
    expect(p.kind).toBe("at_risk");
    if (p.kind === "at_risk") expect(p.currentPct).toBe(62.5);
  });

  it("answers the more useful question when below the line", () => {
    // 5/10 = 50%. Attending n more: (5+n)/(10+n) >= 0.75 first holds at n = 10.
    const p = absenceBuffer(5, 0, 5, 75);
    expect(p.kind).toBe("at_risk");
    if (p.kind === "at_risk") expect(p.mustAttend).toBe(10);
  });

  it("admits when recovery is not possible within the cap", () => {
    const p = absenceBuffer(1, 0, 99, 75, 10);
    expect(p.kind).toBe("unrecoverable");
  });

  it("reports no data rather than NaN when nothing is recorded", () => {
    expect(absenceBuffer(0, 0, 0).kind).toBe("no_data");
  });

  it("never returns a buffer that would itself break the threshold", () => {
    const p = absenceBuffer(18, 0, 2, 75); // 90%
    if (p.kind === "safe") {
      const after = 18 / (20 + p.canMiss);
      expect(after).toBeGreaterThanOrEqual(0.75);
      const oneMore = 18 / (20 + p.canMiss + 1);
      expect(oneMore).toBeLessThan(0.75);
    }
  });
});
