import { RULES, type Rules } from "./rules";

function dayIndex(iso: string) {
  return Math.floor(Date.parse(iso.slice(0, 10) + "T00:00:00Z") / 86_400_000);
}

/**
 * Consistency streak with recovery: up to `streakGraceDays` missed days between
 * active days do not break the streak. The streak counts active days only.
 */
export function computeStreak(activityDates: string[], today: string, rules: Rules = RULES) {
  const days = [...new Set(activityDates.map(dayIndex))].sort((a, b) => b - a);
  if (days.length === 0) return { current: 0, longest: 0 };
  const grace = rules.streakGraceDays;

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i - 1] - days[i] - 1 <= grace) run++;
    else run = 1;
    longest = Math.max(longest, run);
  }

  const gapToToday = dayIndex(today) - days[0] - 1;
  if (gapToToday > grace) return { current: 0, longest };

  let current = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i - 1] - days[i] - 1 <= grace) current++;
    else break;
  }
  return { current, longest };
}
