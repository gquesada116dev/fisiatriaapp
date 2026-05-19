/**
 * Centralized AI model configuration.
 * Swap models here without touching feature code.
 *
 * Costs (USD per 1M tokens, in/out) as a rough guide:
 *   - Opus 4.x    : ~$15 / $75   (best quality, most expensive)
 *   - Sonnet 4.6  : ~$3  / $15   (great quality, balanced)
 *   - Haiku 4.5   : ~$1  / $5    (fast & cheap)
 *
 * Strategy (budget-conscious):
 *   - Summaries: Sonnet (quality matters; cached forever)
 *   - Questions: Sonnet (accuracy in medical MCQs matters)
 *   - Flashcards: Haiku (atoms of info; fine on Haiku)
 *   - Podcast script: Sonnet (conversational quality matters)
 */

export const AI_MODELS = {
  summary: "claude-sonnet-4-6",
  questions: "claude-sonnet-4-6",
  examQuestions: "claude-sonnet-4-6",
  flashcards: "claude-haiku-4-5-20251001",
  podcastScript: "claude-sonnet-4-6",
  examTutor: "claude-sonnet-4-6",
} as const;

/** Bumping these invalidates the cached output for that feature on next request. */
export const PROMPT_VERSIONS = {
  summary: 2,
  questions: 1,
  examQuestions: 1,
  flashcards: 1,
  podcastScript: 1,
} as const;

/** Default max_tokens per feature — tuned to avoid runaway costs. */
export const MAX_TOKENS = {
  summary: 8000,
  questions: 4000,
  examQuestions: 6000,
  flashcards: 3000,
  podcastScript: 6000,
} as const;
