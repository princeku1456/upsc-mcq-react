import { useMemo } from "react";
import { computeQuizStats } from "../lib/statsEngine";

export function useReviewStats(quizData, userAnswers, reviewStats, chapterId) {
  return useMemo(
    () => computeQuizStats(quizData, userAnswers, reviewStats, chapterId),
    [quizData, userAnswers, reviewStats, chapterId]
  );
}
