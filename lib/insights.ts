import { DashboardData } from "@/lib/types";

export function buildInsights(data: DashboardData) {
  const moodCounts = data.checkIns.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.mood] = (accumulator[item.mood] || 0) + 1;
    return accumulator;
  }, {});

  const dominantMood =
    Object.entries(moodCounts).sort((left, right) => right[1] - left[1])[0]?.[0] || data.profile?.mood;

  const averageStress = data.checkIns.length
    ? Math.round(
        data.checkIns.reduce((total, item) => total + item.stressLevel, 0) / data.checkIns.length,
      )
    : null;

  const averageEnergy = data.checkIns.length
    ? Math.round(data.checkIns.reduce((total, item) => total + item.energy, 0) / data.checkIns.length)
    : null;

  const recommendation =
    dominantMood === "Tense" || dominantMood === "Restless"
      ? "Start support sessions with regulation before journaling."
      : dominantMood === "Spent"
        ? "End sessions with permission to stop, not with more tasks."
        : "Keep reinforcing the routines that already stabilize the user.";

  return {
    dominantMood: dominantMood || "Steady",
    averageStress,
    averageEnergy,
    recommendation,
  };
}
