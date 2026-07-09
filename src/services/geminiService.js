import { marked } from "marked";
import { AI_MODEL } from "../config/constants";

export const geminiService = {
  async generateReview(apiKey, history, conceptGapText) {
    const totalTests = history.length;
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
          if (ans.isCorrect) { totalCorrect++; c++; }
          else { totalIncorrect++; inc++; }
        });
      }
      const totalQs = r.totalMarks ? r.totalMarks / 2 : c + inc;
      unatt = Math.max(0, totalQs - (c + inc));
      const dateStr = r.timestamp
        ? new Date(r.timestamp.seconds ? r.timestamp.seconds * 1000 : r.timestamp).toLocaleDateString()
        : "Unknown Date";

      allTestsDetailedArray.push(`
      - ${dateStr}: ${r.chapterName} (${r.subject})
        Score: ${r.scorePercent}% | Breakdown: ${c} Correct, ${inc} Incorrect, ${unatt} Unattempted.
      `);
    }

    const allTestsDetailed = allTestsDetailedArray.join("\n");
    const avgScore = totalTests ? (totalScoreSum / totalTests).toFixed(1) + "%" : "0%";
    const precision = totalAttempted ? ((totalCorrect / totalAttempted) * 100).toFixed(1) + "%" : "0%";
    const negativeLoss = totalIncorrect * 0.66;
    const positiveGain = totalCorrect * 2;
    const drainVal = positiveGain ? ((negativeLoss / positiveGain) * 100).toFixed(1) : 0;
    const drain = drainVal + "%";
    const gap = conceptGapText || "Pending Analysis";

    let weakestSubject = "N/A";
    let weakestScore = 100;
    Object.entries(subjectStats).forEach(([subj, data]) => {
      const avg = data.totalScore / data.count;
      if (avg < weakestScore) {
        weakestScore = avg;
        weakestSubject = `${subj} (${avg.toFixed(1)}%)`;
      }
    });

    const prompt = buildPrompt(totalTests, avgScore, precision, drain, gap, weakestSubject, allTestsDetailed);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || "Failed to fetch AI response");
    }

    const data = await response.json();
    const aiText = data.candidates[0].content.parts[0].text;
    return marked.parse(aiText);
  },
};

function buildPrompt(totalTests, avgScore, precision, drain, gap, weakestSubject, allTestsDetailed) {
  return `
      Act as the **Lead Academic Strategist** for a premier UPSC Civil Services coaching institute. Your objective is to conduct a **Clinical Performance Audit** for a student using the psychometric and academic datasets provided below. 

      ### **1. STUDENT PERFORMANCE DATASET**
      **Core Metrics:**
      - **Stamina (Total Tests):** ${totalTests} (Reliability of data sample)
      - **Baseline Competency (Avg Score):** ${avgScore}
      - **Efficiency Index (Precision/Accuracy):** ${precision}
      - **Risk Impact (Negative Drain):** ${drain}
      - **Foundational Integrity (Concept Gap):** ${gap} (Critical: Easy questions missed)
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
