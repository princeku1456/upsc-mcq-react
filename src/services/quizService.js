import { getCorrectIndex, DifficultyHelper } from "../lib/helpers";
import { SCORING, SUBJECT_KEYS } from "../config/constants";

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
    const confStats = { 100: { total: 0, correct: 0 }, 75: { total: 0, correct: 0 }, 50: { total: 0, correct: 0 }, 0: { total: 0, correct: 0 } };
    let correct = 0, incorrect = 0, unattempted = 0;
    let sillyMistakes = 0, hardSuccess = 0;
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
          if (uAns.answer === cIdx) confStats[uAns.surety].correct++;
        }
        if (uAns.answer === cIdx) { correct++; isCorrect = true; statusStr = "correct"; }
        else { incorrect++; statusStr = "incorrect"; }
      } else { unattempted++; }

      let dLabel = "Unknown";
      if (!isRevision && reviewStats) {
        const commCorrect = reviewStats.correctCounts ? reviewStats.correctCounts[idx] : 0;
        const commTotal = reviewStats.totalAttempts || 0;
        dLabel = DifficultyHelper.calculate(commCorrect, commTotal).label;
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
      if (dLabel === "Hard" && statusStr === "correct") hardSuccess++;

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

    const finalScore = correct * SCORING.CORRECT - incorrect * SCORING.INCORRECT;
    const totalMarks = quizData.length * SCORING.CORRECT;

    return { confStats, correct, incorrect, unattempted, finalScore, totalMarks, sillyMistakes, hardSuccess, missedEasyQNumbers, difficultyStats, subjectStats, isRevision };
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
