import { getCorrectIndex } from "../lib/helpers";
import { SCORING } from "../config/constants";
import { computeQuizStats } from "../lib/statsEngine";

export const quizService = {
  calculateScore(userAnswers, quizData) {
    let score = 0;
    let correct = 0;
    let incorrect = 0;
    let unattempted = 0;

    quizData.forEach((q, i) => {
      const uAns = userAnswers[i];
      if (uAns) {
        userAnswers[i].isCorrect = uAns.answer === getCorrectIndex(q);
        if (userAnswers[i].isCorrect) {
          score += SCORING.CORRECT;
          correct++;
        } else {
          score -= SCORING.INCORRECT;
          incorrect++;
        }
      } else {
        unattempted++;
      }
    });

    const finalScore = parseFloat(score.toFixed(2));
    const totalMarks = quizData.length * 2;
    const percentage = totalMarks > 0 ? ((finalScore / totalMarks) * 100).toFixed(1) : 0;

    return { finalScore, totalMarks, percentage, correct, incorrect, unattempted };
  },

  calculateAccuracies(questions, results) {
    return questions.map((q, qIdx) => {
      const correctIndex = getCorrectIndex(q);
      let correctCount = 0;
      results.forEach((res) => {
        const choice = res.userAnswers ? res.userAnswers[qIdx] : null;
        if (choice && choice.answer === correctIndex) correctCount++;
      });
      return results.length > 0
        ? Math.round((correctCount / results.length) * 100)
        : 0;
    });
  },

  computeReviewStats(quizData, userAnswers, reviewStats, chapterId) {
    return computeQuizStats(quizData, userAnswers, reviewStats, chapterId);
  },

  computeSubjectBreakdown(questions, userAnswers) {
    const subjectStats = {};
    questions.forEach((q, index) => {
      const correctIndex = getCorrectIndex(q);
      const uAns = userAnswers[index];
      const attempted = uAns !== undefined;
      const isCorrect = attempted && uAns.answer === correctIndex;

      if (q.subject) {
        const subj = q.subject.trim();
        if (!subjectStats[subj]) {
          subjectStats[subj] = { total: 0, correct: 0, incorrect: 0, unattempted: 0 };
        }
        subjectStats[subj].total++;
        if (!attempted) subjectStats[subj].unattempted++;
        else if (isCorrect) subjectStats[subj].correct++;
        else subjectStats[subj].incorrect++;
      }
    });
    return subjectStats;
  },
};
