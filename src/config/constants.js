export const AI_MODEL = "gemini-flash-latest";

export const MAX_USER_HISTORY = 20;

export const LEADERBOARD_LIMIT = 10;

export const SCORING = {
  CORRECT: 2,
  INCORRECT: 0.66,
};

export const CONFIDENCE_LEVELS = [100, 75, 50, 0];

export const REVISION_QUESTION_OPTIONS = [10, 20, 30, 50];

export const CACHE_TTL = {
  MANIFEST: 86400000,
  QUESTIONS: 86400000,
  STATS: 3600000,
  GEMINI_KEY: 86400000,
};

export const SUBJECT_KEYS = [
  "Polity",
  "Economy",
  "History",
  "Geography",
  "Environment",
  "Science and Tech",
  "IR",
];

export const LABEL_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export const QUIZ_TIMER_PER_QUESTION_SECONDS = 90;

export const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "correct", label: "Correct" },
  { id: "incorrect", label: "Incorrect" },
  { id: "unattempted", label: "Unattempted" },
];
