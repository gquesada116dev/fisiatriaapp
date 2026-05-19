/**
 * SuperMemo 2 (SM-2) — classic implementation.
 *
 * Quality scale (Anki-style, 0-5):
 *   0 = complete blackout
 *   1 = incorrect, but on seeing answer it felt familiar
 *   2 = incorrect, but easy to remember after
 *   3 = correct, recalled with serious difficulty
 *   4 = correct, after some hesitation
 *   5 = perfect recall
 *
 * Below 3 = lapse: reset reps to 0, interval to 1 day.
 * 3-5 = success: progress repetitions and grow interval.
 *
 * Reference: Wozniak, P.A. (1990). Optimization of repetition spacing
 * in the practice of learning. Algorithm SM-2.
 */

export type SM2State = {
  repetitions: number;   // n: number of successful reps in a row
  easeFactor: number;    // EF: ≥ 1.3
  intervalDays: number;  // I: current interval in days
};

export const SM2_DEFAULT: SM2State = { repetitions: 0, easeFactor: 2.5, intervalDays: 0 };

export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

export type SM2Result = SM2State & { dueAt: Date };

/**
 * Apply one review.
 * `now` is injected for testability.
 */
export function sm2(state: SM2State, quality: Quality, now: Date = new Date()): SM2Result {
  let { repetitions, easeFactor, intervalDays } = state;

  if (quality < 3) {
    // Lapse: reset reps, see again tomorrow.
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easeFactor);
    repetitions += 1;
  }

  // EF update (applies on every grade in classic SM-2).
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const dueAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  return { repetitions, easeFactor, intervalDays, dueAt };
}
