import React, { useEffect, useRef, useState, useCallback } from "react";
import { marked } from "marked";
import { useApp } from "../store";
import { DataManager } from "../lib/dataManager";
import { ChartHelper } from "../lib/chartHelper";
import { calculateConfidenceStats, DifficultyHelper } from "../lib/helpers";
import { toastr } from "../lib/toastr";
import { useNavigate } from "react-router-dom";

export default function DashboardView() {
  const { currentUser, g, theme } = useApp();
  const navigate = useNavigate();

  const [loaded, setLoaded] = useState(g.dashboardDataLoaded);
  const [dashMode, setDashMode] = useState(g.currentDashboardMode);
  const [conceptGap, setConceptGap] = useState({ text: "0%", cls: "stat--pen" });
  const [aiState, setAiState] = useState({ loading: false, html: null, error: false });

  const perfChartRef = useRef(null);
  const confChartRef = useRef(null);
  const perfInstance = useRef(null);
  const confInstance = useRef(null);

  /* ---- loadUserDashboard (verbatim logic) ---- */
  useEffect(() => {
    let cancelled = false;
    async function loadUserDashboard(forceRefresh = false) {
      if (!currentUser || !currentUser.emailVerified) return;

      if (
        !forceRefresh &&
        g.dashboardDataLoaded &&
        (g.userHistory.length > 0 || g.practiceHistory.length > 0)
      ) {
        setLoaded(true);
        return;
      }

      try {
        const historyData = await DataManager.syncUserHistory(currentUser.uid, forceRefresh);
        const practiceData = await DataManager.syncPracticeHistory(currentUser.uid, forceRefresh);

        if (cancelled) return;

        if (historyData) g.userHistory = historyData;
        if (practiceData) g.practiceHistory = practiceData;

        if (historyData || practiceData) {
          g.dashboardDataLoaded = true;
          setLoaded(true);
        }
      } catch (error) {
        console.error("Error loading dashboard:", error);
        toastr.error("Failed to load performance data.");
      }
    }
    loadUserDashboard();
    return () => {
      cancelled = true;
    };
  }, [currentUser, g]);

  /* ---- Cumulative Stats Calculation (verbatim) ---- */
  const combinedHistory = [...g.userHistory, ...g.practiceHistory];
  const chartData = dashMode === "quiz" ? g.userHistory : g.practiceHistory;

  const totalTests = combinedHistory.length;
  const avgScore = totalTests
    ? (combinedHistory.reduce((acc, curr) => acc + curr.scorePercent, 0) / totalTests).toFixed(1)
    : 0;

  let totalCorrect = 0,
    totalIncorrect = 0,
    totalAttempted = 0,
    totalQs = 0;

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

  const totalUnattempted = totalQs - totalAttempted;
  const precisionRate = totalAttempted
    ? ((totalCorrect / totalAttempted) * 100).toFixed(1)
    : 0;
  const negativeLoss = totalIncorrect * 0.66;
  const positiveGain = totalCorrect * 2;
  const negativeDrain = positiveGain
    ? ((negativeLoss / positiveGain) * 100).toFixed(1)
    : 0;

  /* ---- Charts ---- */
  useEffect(() => {
    const { confValues, confStats } = calculateConfidenceStats(chartData);

    if (perfInstance.current) {
      perfInstance.current.destroy();
      perfInstance.current = null;
    }
    if (perfChartRef.current) {
      perfInstance.current = ChartHelper.renderPerformanceChart(perfChartRef.current, chartData);
    }

    if (confInstance.current) {
      confInstance.current.destroy();
      confInstance.current = null;
    }
    if (confChartRef.current) {
      confInstance.current = ChartHelper.renderConfidenceChart(
        confChartRef.current,
        confValues,
        confStats
      );
    }

    return () => {
      if (perfInstance.current) {
        perfInstance.current.destroy();
        perfInstance.current = null;
      }
      if (confInstance.current) {
        confInstance.current.destroy();
        confInstance.current = null;
      }
    };
  }, [loaded, dashMode, theme]);

  /* ---- updateConceptGapStat ---- */
  useEffect(() => {
    let cancelled = false;
    async function updateConceptGapStat(results) {
      setConceptGap((cg) => ({ ...cg, text: "..." }));

      try {
        const uniqueChapters = [...results.reduce((acc, r) => acc.add(r.chapterId), new Set())];
        const statsMap = {};

        const promises = uniqueChapters.map(async (id) => {
          const stats = await DataManager.fetchGlobalStats(id);
          if (stats) statsMap[id] = stats;
        });
        await Promise.all(promises);
        if (cancelled) return;

        let sillyMistakes = 0;
        let totalQuestionsAttempted = 0;

        results.forEach((res) => {
          const stats = statsMap[res.chapterId];
          if (!stats || !res.userAnswers) return;

          Object.entries(res.userAnswers).forEach(([index, ans]) => {
            totalQuestionsAttempted++;
            if (!ans.isCorrect) {
              const qIdx = parseInt(index);
              const commCorrect = (stats.correctCounts && stats.correctCounts[qIdx]) || 0;
              const commTotal = stats.totalAttempts || 0;
              const diffInfo = DifficultyHelper.calculate(commCorrect, commTotal);

              if (diffInfo.label === "Easy") sillyMistakes++;
            }
          });
        });

        const gapPercent = totalQuestionsAttempted
          ? ((sillyMistakes / totalQuestionsAttempted) * 100).toFixed(1)
          : 0;

        setConceptGap({
          text: gapPercent + "%",
          cls: gapPercent > 15 ? "stat--stamp" : "stat--leaf",
        });
      } catch (error) {
        console.error("Concept gap calculation error:", error);
        setConceptGap({ text: "N/A", cls: "stat--pen" });
      }
    }
    if (loaded) updateConceptGapStat([...g.userHistory, ...g.practiceHistory]);
    return () => {
      cancelled = true;
    };
  }, [loaded]);

  /* ---- AI MENTOR ---- */
  const generateAIReview = useCallback(async () => {
    const key = await DataManager.fetchGeminiKey();
    const GEMINI_MODEL = "gemini-flash-latest";

    if (!key || key === "YOUR_GEMINI_API_KEY_HERE") {
      toastr.warning("AI Service not configured. Please contact support.");
      return;
    }

    setAiState({
      loading: true,
      html: `<div class="empty"><div class="spinner"></div><p>Analyzing performance...</p></div>`,
      error: false,
    });

    try {
      const userHistory = g.userHistory;
      if (!userHistory || userHistory.length === 0) {
        throw new Error("No test history available to analyze.");
      }

      const totalTests = userHistory.length;
      let totalScoreSum = 0;
      let totalCorrect = 0, totalIncorrect = 0, totalAttempted = 0;
      const subjectStats = {};
      const allTestsDetailedArray = [];

      for (let i = 0; i < userHistory.length; i++) {
        const r = userHistory[i];
        totalScoreSum += r.scorePercent;

        if (!subjectStats[r.subject]) {
          subjectStats[r.subject] = { totalScore: 0, count: 0 };
        }
        subjectStats[r.subject].totalScore += r.scorePercent;
        subjectStats[r.subject].count++;

        let correct = 0, incorrect = 0, unattempted = 0;
        if (r.userAnswers) {
          for (const key in r.userAnswers) {
            const ans = r.userAnswers[key];
            totalAttempted++;
            if (ans.isCorrect) { totalCorrect++; correct++; }
            else { totalIncorrect++; incorrect++; }
          }
        }
        const totalQs = r.totalMarks ? r.totalMarks / 2 : correct + incorrect;
        unattempted = Math.max(0, totalQs - (correct + incorrect));
        const dateStr = r.timestamp ? new Date(r.timestamp.seconds * 1000).toLocaleDateString() : "Unknown Date";

        allTestsDetailedArray.push(`
      - ${dateStr}: ${r.chapterName} (${r.subject})
        Score: ${r.scorePercent}% | Breakdown: ${correct} Correct, ${incorrect} Incorrect, ${unattempted} Unattempted.
      `);
      }

      const allTestsDetailed = allTestsDetailedArray.join("\n");
      const avgScore = totalTests ? (totalScoreSum / totalTests).toFixed(1) + "%" : "0%";
      const precision = totalAttempted ? ((totalCorrect / totalAttempted) * 100).toFixed(1) + "%" : "0%";

      const negativeLoss = totalIncorrect * 0.66;
      const positiveGain = totalCorrect * 2;
      const drainVal = positiveGain ? ((negativeLoss / positiveGain) * 100).toFixed(1) : 0;
      const drain = drainVal + "%";

      const gap = document.getElementById("stat-concept-gap")?.textContent || "Pending Analysis";

      let weakestSubject = "N/A";
      let weakestScore = 100;
      Object.entries(subjectStats).forEach(([subj, data]) => {
        const avg = data.totalScore / data.count;
        if (avg < weakestScore) {
          weakestScore = avg;
          weakestSubject = `${subj} (${avg.toFixed(1)}%)`;
        }
      });

      const prompt = `
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

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
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
      const formattedText = marked.parse(aiText);

      setAiState({
        loading: false,
        html: `<div class="animate-fade-in markdown-content">${formattedText}</div>`,
        error: false,
      });
    } catch (error) {
      console.error("AI Error:", error);
      toastr.error("AI Analysis Failed: " + error.message);
      setAiState({
        loading: false,
        html: `<p style="color:var(--stamp)">Failed to generate review. Please check system configuration.</p>`,
        error: true,
      });
    }
  }, [g]);

  const switchDashboardMode = (mode) => {
    g.currentDashboardMode = mode;
    setDashMode(mode);
  };

  return (
    <div className="page">
      <div className="dash__hero">
        <h1>My Dashboard</h1>
        <p>Your performance analytics and learning path.</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <Stat variant="pen" label="Tests Taken" value={totalTests} />
        <Stat variant="marker" label="Avg. Score" value={`${avgScore}%`} />
        <Stat variant="leaf" label="Precision" value={`${precisionRate}%`} sub="Net Accuracy" />
        <Stat variant="stamp" label="Neg. Drain" value={`${negativeDrain}%`} sub="Marks Lost" />
        <div className={`stat ${conceptGap.cls}`}>
          <span className="eyebrow">Concept Gap</span>
          <span className="stat__value" id="stat-concept-gap">{conceptGap.text}</span>
          <span className="stat__sub">Easy Qs Missed</span>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <Stat label="Total Qs" value={totalQs} />
        <Stat variant="pen" label="Attempted" value={totalAttempted} />
        <Stat label="Unattempted" value={Math.max(0, totalUnattempted)} />
        <Stat variant="leaf" label="Correct" value={totalCorrect} />
        <Stat variant="stamp" label="Incorrect" value={totalIncorrect} />
      </div>

      <div className="action-grid" style={{ marginBottom: 28 }}>
        <div className="card action-card" onClick={() => navigate("/subjects")}>
          <div className="action-card__icon">🚀</div>
          <div className="action-card__label hl" style={{ color: "var(--leaf)" }}>Take Test</div>
        </div>
        <div className="card action-card" onClick={() => navigate("/practice/config")}>
          <div className="action-card__icon">🎯</div>
          <div className="action-card__label hl" style={{ color: "var(--pen)" }}>Practice MCQ</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28, background: "linear-gradient(135deg, var(--card) 0%, var(--pen-soft) 100%)" }}>
        <div className="card__head">
          <h2 className="card__title">✨ AI Personalized Mentor</h2>
          <span className="badge badge--pen">Gemini</span>
        </div>
        <div id="ai-review-content" style={{ minHeight: 60, marginBottom: 16 }}>
          {aiState.html ? (
            <div dangerouslySetInnerHTML={{ __html: aiState.html }} />
          ) : (
            <p style={{ color: "var(--ink-soft)", margin: 0 }}>
              Get a personalized performance review powered by Google Gemini AI. Analyze your weak spots, negative marking patterns, and confidence gaps.
            </p>
          )}
        </div>
        <button
          className="btn btn--primary"
          onClick={generateAIReview}
          disabled={aiState.loading}
        >
          {aiState.loading ? (
            <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></div> Analyzing...</>
          ) : (
            "⚡ Analyze My Performance"
          )}
        </button>
      </div>

      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div className="tabs">
          <button
            className={`tabs__tab ${dashMode === "quiz" ? "tabs__tab--active" : ""}`}
            onClick={() => switchDashboardMode("quiz")}
          >
            Tests Analysis
          </button>
          <button
            className={`tabs__tab ${dashMode === "practice" ? "tabs__tab--active" : ""}`}
            onClick={() => switchDashboardMode("practice")}
          >
            Practice Analysis
          </button>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">🎯 Overall Confidence Analysis</h2>
          </div>
          <div className="chart-wrap">
            <canvas id="globalConfidenceChart" ref={confChartRef}></canvas>
          </div>
        </div>
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">📈 Accuracy Trend</h2>
          </div>
          <div className="chart-wrap">
            <canvas id="performanceChart" ref={perfChartRef}></canvas>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ variant, label, value, sub }) {
  const vClass = variant ? `stat--${variant}` : "";
  return (
    <div className={`stat ${vClass}`}>
      <span className="eyebrow">{label}</span>
      <span className="stat__value">{value}</span>
      {sub && <span className="stat__sub">{sub}</span>}
    </div>
  );
}
