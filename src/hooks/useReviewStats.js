import { useMemo } from "react";
import { getCorrectIndex, DifficultyHelper } from "../lib/helpers";
import { SUBJECT_KEYS } from "../config/constants";

export function useReviewStats(quizData, userAnswers, reviewStats, chapterId) {
  return useMemo(() => {
    const confStats = {
      100: { total: 0, correct: 0 },
      75: { total: 0, correct: 0 },
      50: { total: 0, correct: 0 },
      0: { total: 0, correct: 0 },
    };

    let correct = 0;
    let incorrect = 0;
    let unattempted = 0;
    let sillyMistakes = 0;
    let hardSuccess = 0;
    const missedEasyQNumbers = [];

    const difficultyStats = {
      Easy: { total: 0, correct: 0, incorrect: 0, unattempted: 0 },
      Medium: { total: 0, correct: 0, incorrect: 0, unattempted: 0 },
      Hard: { total: 0, correct: 0, incorrect: 0, unattempted: 0 },
    };

    const subjectStats = {};
    SUBJECT_KEYS.forEach((k) => {
      subjectStats[k] = { total: 0, correct: 0, incorrect: 0, unattempted: 0 };
    });

    const isRevision = chapterId.startsWith("revision_");

    quizData.forEach((q, idx) => {
      const uAns = userAnswers[idx];
      const cIdx = getCorrectIndex(q);

      let isCorrect = false;
      let statusStr = "unattempted";

      if (uAns) {
        if (uAns.surety !== undefined && confStats[uAns.surety]) {
          confStats[uAns.surety].total++;
          if (uAns.answer === cIdx) {
            confStats[uAns.surety].correct++;
          }
        }
        if (uAns.answer === cIdx) {
          correct++;
          isCorrect = true;
          statusStr = "correct";
        } else {
          incorrect++;
          statusStr = "incorrect";
        }
      } else {
        unattempted++;
      }

      let dLabel = "Unknown";
      if (!isRevision && reviewStats) {
        const commCorrect = reviewStats.correctCounts ? reviewStats.correctCounts[idx] : 0;
        const commTotal = reviewStats.totalAttempts || 0;
        const dInfo = DifficultyHelper.calculate(commCorrect, commTotal);
        dLabel = dInfo.label;
      } else if (isRevision) {
        dLabel = "Revision";
      }

      if (difficultyStats[dLabel]) {
        difficultyStats[dLabel].total++;
        if (statusStr === "correct") difficultyStats[dLabel].correct++;
        else if (statusStr === "incorrect") difficultyStats[dLabel].incorrect++;
        else difficultyStats[dLabel].unattempted++;
      }

      if (dLabel === "Easy" && (statusStr === "incorrect" || statusStr === "unattempted")) {
        sillyMistakes++;
        missedEasyQNumbers.push(idx + 1);
      }
      if (dLabel === "Hard" && statusStr === "correct") {
        hardSuccess++;
      }

      let qSubj = "Unknown";
      if (q.tags && q.tags.length > 0) {
        const subjTag = q.tags.find((t) => t.startsWith("subject:"));
        if (subjTag) qSubj = subjTag.replace("subject:", "").trim();
      }
      if (subjectStats[qSubj]) {
        subjectStats[qSubj].total++;
        if (statusStr === "correct") subjectStats[qSubj].correct++;
        else if (statusStr === "incorrect") subjectStats[qSubj].incorrect++;
        else subjectStats[qSubj].unattempted++;
      }
    });

    const finalScore = correct * 2 - incorrect * 0.66;
    const totalMarks = quizData.length * 2;

    return {
      confStats,
      correct,
      incorrect,
      unattempted,
      finalScore,
      totalMarks,
      sillyMistakes,
      hardSuccess,
      missedEasyQNumbers,
      difficultyStats,
      subjectStats,
      isRevision,
    };
  }, [quizData, userAnswers, reviewStats, chapterId]);
}
