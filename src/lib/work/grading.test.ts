import { describe, expect, it } from "vitest";
import { normalizeWorkGradingSettings, workGradeContribution, workGradingLabel } from "@/lib/work/grading";

describe("work grading settings", () => {
  it("normalizes weighted work and calculates course contribution", () => {
    const settings = normalizeWorkGradingSettings({
      mode: "weighted",
      gradeWeightPercent: 5,
      countsTowardGrade: true,
    });

    expect(settings).toMatchObject({ mode: "weighted", gradeWeightPercent: 5, countsTowardGrade: true });
    expect(workGradeContribution({ pointsEarned: 80, pointsPossible: 100, settings })).toBe(4);
    expect(workGradingLabel(settings, 100)).toBe("100 pts -> 5% of course");
  });

  it("keeps completion and participation out of averaged grades", () => {
    const completion = normalizeWorkGradingSettings({ mode: "completion", countsTowardGrade: true });
    const participation = normalizeWorkGradingSettings({ mode: "participation", participationCriteria: "Post once" });

    expect(completion.countsTowardGrade).toBe(false);
    expect(participation.countsTowardGrade).toBe(false);
    expect(workGradeContribution({ pointsEarned: 10, pointsPossible: 10, settings: participation })).toBeNull();
    expect(workGradingLabel(completion, 0)).toBe("Completion only");
    expect(workGradingLabel(participation, 10)).toBe("Participation");
  });
});
