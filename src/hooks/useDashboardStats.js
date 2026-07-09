import { useMemo } from "react";

export function useDashboardStats(userHistory) {
  return useMemo(() => {
    const combinedHistory = userHistory || [];
    const totalTests = combinedHistory.length;

    const avgScore = totalTests
      ? (combinedHistory.reduce((acc, curr) => acc + (curr.scorePercent || 0), 0) / totalTests).toFixed(1)
      : 0;

    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalAttempted = 0;
    let totalQs = 0;

    combinedHistory.forEach((res) => {
      if (res.totalMarks) {
        totalQs += res.totalMarks / 2;
      } else {
        totalQs += (res.correctCount + res.incorrectCount + res.unattemptedCount) || 0;
      }

      if (res.userAnswers) {
        Object.values(res.userAnswers).forEach((ans) => {
          if (ans && ans.answer !== undefined && ans.answer !== -1) {
            totalAttempted++;
            if (ans.isCorrect) totalCorrect++;
            else totalIncorrect++;
          }
        });
      }
    });

    const totalUnattempted = Math.max(0, totalQs - totalAttempted);
    const precisionRate = totalAttempted
      ? ((totalCorrect / totalAttempted) * 100).toFixed(1)
      : 0;

    const negativeLoss = totalIncorrect * 0.66;
    const positiveGain = totalCorrect * 2;
    const negativeDrain = positiveGain
      ? ((negativeLoss / positiveGain) * 100).toFixed(1)
      : 0;

    return {
      totalTests,
      avgScore,
      totalQs,
      totalAttempted,
      totalUnattempted,
      totalCorrect,
      totalIncorrect,
      precisionRate,
      negativeDrain,
    };
  }, [userHistory]);
}
