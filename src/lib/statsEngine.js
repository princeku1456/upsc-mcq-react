import { getCorrectIndex, DifficultyHelper } from "./helpers";
import { SCORING, SUBJECT_KEYS } from "../config/constants";

export function computeQuizStats(quizData, userAnswers, reviewStats, chapterId) {
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

  const isRevision = chapterId && chapterId.startsWith("revision_");

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

  const finalScore = parseFloat((correct * SCORING.CORRECT - incorrect * SCORING.INCORRECT).toFixed(2));
  const totalMarks = quizData.length * SCORING.CORRECT;

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
}

export function computeHistoryAggregates(history) {
  let totalScoreSum = 0;
  let totalCorrect = 0;
  let totalIncorrect = 0;
  let totalAttempted = 0;
  const subjectStats = {};
  const allTestsDetailedArray = [];

  for (const r of history) {
    totalScoreSum += r.scorePercent || 0;

    if (!subjectStats[r.subject]) {
      subjectStats[r.subject] = { totalScore: 0, count: 0 };
    }
    subjectStats[r.subject].totalScore += r.scorePercent || 0;
    subjectStats[r.subject].count++;

    let c = 0;
    let inc = 0;
    let unatt = 0;
    if (r.userAnswers) {
      Object.values(r.userAnswers).forEach((ans) => {
        totalAttempted++;
        if (ans.isCorrect) {
          totalCorrect++;
          c++;
        } else {
          totalIncorrect++;
          inc++;
        }
      });
    }
    const totalQs = r.totalMarks ? r.totalMarks / SCORING.CORRECT : c + inc;
    unatt = Math.max(0, totalQs - (c + inc));
    const dateStr = r.timestamp
      ? new Date(r.timestamp.seconds ? r.timestamp.seconds * 1000 : r.timestamp).toLocaleDateString()
      : "Unknown Date";

    allTestsDetailedArray.push(`
      - ${dateStr}: ${r.chapterName} (${r.subject})
        Score: ${r.scorePercent}% | Breakdown: ${c} Correct, ${inc} Incorrect, ${unatt} Unattempted.
      `);
  }

  const totalTests = history.length;
  const allTestsDetailed = allTestsDetailedArray.join("\n");
  const avgScore = totalTests ? (totalScoreSum / totalTests).toFixed(1) + "%" : "0%";
  const precision = totalAttempted ? ((totalCorrect / totalAttempted) * 100).toFixed(1) + "%" : "0%";

  const negativeLoss = totalIncorrect * SCORING.INCORRECT;
  const positiveGain = totalCorrect * SCORING.CORRECT;
  const drainVal = positiveGain ? ((negativeLoss / positiveGain) * 100).toFixed(1) : 0;
  const drain = drainVal + "%";

  let weakestSubject = "N/A";
  let weakestScore = 100;
  Object.entries(subjectStats).forEach(([subj, data]) => {
    const avg = data.totalScore / data.count;
    if (avg < weakestScore) {
      weakestScore = avg;
      weakestSubject = `${subj} (${avg.toFixed(1)}%)`;
    }
  });

  return {
    totalTests,
    avgScore,
    precision,
    drain,
    weakestSubject,
    allTestsDetailed,
    totalCorrect,
    totalIncorrect,
    totalAttempted,
    totalScoreSum,
    subjectStats,
  };
}

export function buildAIPrompt({ totalTests, avgScore, precision, drain, conceptGapText, weakestSubject, allTestsDetailed }) {
  return `
      Act as the **Lead Academic Strategist** for a premier UPSC Civil Services coaching institute. Your objective is to conduct a **Clinical Performance Audit** for a student using the psychometric and academic datasets provided below. 

      ### **1. STUDENT PERFORMANCE DATASET**
      **Core Metrics:**
      - **Stamina (Total Tests):** ${totalTests} (Reliability of data sample)
      - **Baseline Competency (Avg Score):** ${avgScore}
      - **Efficiency Index (Precision/Accuracy):** ${precision}
      - **Risk Impact (Negative Drain):** ${drain}
      - **Foundational Integrity (Concept Gap):** ${conceptGapText} (Critical: Easy questions missed)
      - **High-Priority Weakness:** ${weakestSubject}

      **Raw Longitudinal History:**
      ${allTestsDetailed}

      ---

      ### **2. ANALYTICAL REQUIREMENTS & INSTRUCTIONS**
      Perform your analysis using a **data-first diagnostic approach**. Your review MUST include:

      #### **A. Root Cause Analysis (RCA): Weakest Subject**
      Don't just suggest reading more. Diagnose if the failure in **${weakestSubject}** is due to *Conceptual Fog* (fundamental misunderstanding) or *Application Failure* (unable to eliminate options). Provide a 3-step hierarchical fix (Foundational → Applied → Simulated).

      #### **B. Behavioral Response Mapping**
      Scan the **Longitudinal History** for psychological trends:
      - **Fatigue Decay:** Do scores drop in later tests or during specific streaks?
      - **The Guesswork Trap:** Compare 'Precision' vs 'Negative Drain'. Is the student's "Calculated Risk" actually hurting their net gain?
      - **Volatity vs. Plateau:** Is the student consistently average, or experiencing wild swings in performance?

      #### **C. The 48-Hour Tactical Roadmap**
      Provide exactly **3 SMART (Specific, Measurable, Achievable, Relevant, Time-bound) Tasks** for the very next study session. These must be hyper-specific (e.g., "Review 50 previous 'Easy' misses" rather than "Study more").

      ### **3. STYLE & TONE CONSTRAINTS**
      - **Tone:** authoritative, clinical, data-driven, yet high-conviction and encouraging.
      - **Formatting:** Use **Bold** for critical insights and code blocks or bullet points for specific techniques.
      - **Goal:** Move the student from "Hard Work" to "Precision Work."
    `;
}
