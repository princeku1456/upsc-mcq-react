/* =========================================
   3. DASHBOARD (ported from dashboard.js + index.html markup)
   All calculations are byte-for-byte identical; only the rendering
   layer changed from imperative DOM writes to React state.
   ========================================= */
import React, { useEffect, useRef, useState, useCallback } from "react";
import { marked } from "marked";
import { useApp } from "../store";
import { DataManager } from "../lib/dataManager";
import { ChartHelper } from "../lib/chartHelper";
import {
  calculateConfidenceStats,
  DifficultyHelper,
} from "../lib/helpers";
import { toastr } from "../lib/toastr";

export default function DashboardView() {
  const { currentUser, g, theme, showTestSelection, startPracticeSelection } =
    useApp();

  const [loaded, setLoaded] = useState(g.dashboardDataLoaded);
  const [dashMode, setDashMode] = useState(g.currentDashboardMode);
  const [conceptGap, setConceptGap] = useState({ text: "0%", cls: "border-info" });
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
        // Incrementally sync user history (Smart Sync)
        const historyData = await DataManager.syncUserHistory(
          currentUser.uid,
          forceRefresh
        );
        const practiceData = await DataManager.syncPracticeHistory(
          currentUser.uid,
          forceRefresh
        );

        if (cancelled) return;

        if (historyData) {
          g.userHistory = historyData;
        }
        if (practiceData) {
          g.practiceHistory = practiceData;
        }

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

  /* ---- Cumulative Stats Calculation (verbatim from renderDashboardUI) ---- */
  const combinedHistory = [...g.userHistory, ...g.practiceHistory];
  const chartData = dashMode === "quiz" ? g.userHistory : g.practiceHistory;

  const totalTests = combinedHistory.length;
  const avgScore = totalTests
    ? (
        combinedHistory.reduce((acc, curr) => acc + curr.scorePercent, 0) /
        totalTests
      ).toFixed(1)
    : 0;

  let totalCorrect = 0,
    totalIncorrect = 0,
    totalAttempted = 0,
    totalQs = 0;

  combinedHistory.forEach((res) => {
    if (res.totalMarks) {
      totalQs += res.totalMarks / 2;
    } else {
      totalQs +=
        (res.correctCount + res.incorrectCount + res.unattemptedCount) || 0;
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

  /* ---- Charts (renderPerformanceChart + renderGlobalConfidenceChart) ---- */
  useEffect(() => {
    const { confValues, confStats } = calculateConfidenceStats(chartData);

    if (perfInstance.current) {
      perfInstance.current.destroy();
      perfInstance.current = null;
    }
    if (perfChartRef.current) {
      perfInstance.current = ChartHelper.renderPerformanceChart(
        perfChartRef.current,
        chartData
      );
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
    // Re-render charts when data loads, mode switches, or theme changes
    // (theme dependency replicates refreshDashboardChartsOnly)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, dashMode, theme]);

  /* ---- updateConceptGapStat (verbatim logic) ---- */
  useEffect(() => {
    let cancelled = false;
    async function updateConceptGapStat(results) {
      setConceptGap((cg) => ({ ...cg, text: "Analyzing..." }));

      try {
        const uniqueChapters = [
          ...results.reduce((acc, r) => acc.add(r.chapterId), new Set()),
        ];
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
              const commCorrect =
                (stats.correctCounts && stats.correctCounts[qIdx]) || 0;
              const commTotal = stats.totalAttempts || 0;
              const diffInfo = DifficultyHelper.calculate(
                commCorrect,
                commTotal
              );

              // Flag if user missed a question that is classified as Easy
              if (diffInfo.label === "Easy") sillyMistakes++;
            }
          });
        });

        const gapPercent = totalQuestionsAttempted
          ? ((sillyMistakes / totalQuestionsAttempted) * 100).toFixed(1)
          : 0;

        // Dynamic color coding based on threshold
        setConceptGap({
          text: gapPercent + "%",
          cls: gapPercent > 15 ? "border-danger" : "border-success",
        });
      } catch (error) {
        console.error("Concept gap calculation error:", error);
        setConceptGap({ text: "N/A", cls: "border-info" });
      }
    }
    if (loaded) updateConceptGapStat([...g.userHistory, ...g.practiceHistory]);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  /* =========================================
     4. AI MENTOR LOGIC (generateAIReview, verbatim)
     ========================================= */
  const generateAIReview = useCallback(async () => {
    const key = await DataManager.fetchGeminiKey();
    const GEMINI_MODEL = "gemini-flash-latest"; // Validated working alias

    if (!key) {
      toastr.warning(
        "AI Service not configured in Firebase. Please contact admin."
      );
      console.error("Missing gemini_api_key in Firestore (app_config/keys)");
      return;
    }

    console.log("Using Gemini Key:", key ? "Loaded" : "MISSING");
    if (!key || key === "YOUR_GEMINI_API_KEY_HERE") {
      toastr.warning(
        "AI Service not configured. Please contact support or check config.js"
      );
      console.error("Missing GEMINI_API_KEY in config.js");
      return;
    }

    setAiState({ loading: true, html: `<div class="text-center text-muted"><p>Thinking...</p></div>`, error: false });

    try {
      const userHistory = g.userHistory;
      if (!userHistory || userHistory.length === 0) {
        throw new Error("No test history available to analyze.");
      }

      // --- 1. Calculate Metrics from Fresh Data ---
      const totalTests = userHistory.length;

      let totalScoreSum = 0;
      let totalCorrect = 0;
      let totalIncorrect = 0;
      let totalAttempted = 0;

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

        let correct = 0,
          incorrect = 0,
          unattempted = 0;

        if (r.userAnswers) {
          for (const key in r.userAnswers) {
            const ans = r.userAnswers[key];
            totalAttempted++;
            if (ans.isCorrect) {
              totalCorrect++;
              correct++;
            } else {
              totalIncorrect++;
              incorrect++;
            }
          }
        }

        const totalQs = r.totalMarks ? r.totalMarks / 2 : correct + incorrect;
        unattempted = Math.max(0, totalQs - (correct + incorrect));

        const dateStr = r.timestamp
          ? new Date(r.timestamp.seconds * 1000).toLocaleDateString()
          : "Unknown Date";

        allTestsDetailedArray.push(`
      - ${dateStr}: ${r.chapterName} (${r.subject})
        Score: ${r.scorePercent}% | Breakdown: ${correct} Correct, ${incorrect} Incorrect, ${unattempted} Unattempted.
      `);
      }

      const allTestsDetailed = allTestsDetailedArray.join("\n");

      const avgScore = totalTests
        ? (totalScoreSum / totalTests).toFixed(1) + "%"
        : "0%";
      const precision = totalAttempted
        ? ((totalCorrect / totalAttempted) * 100).toFixed(1) + "%"
        : "0%";

      const negativeLoss = totalIncorrect * 0.66;
      const positiveGain = totalCorrect * 2;
      const drainVal = positiveGain
        ? ((negativeLoss / positiveGain) * 100).toFixed(1)
        : 0;
      const drain = drainVal + "%";

      const gapEl = document.getElementById("stat-concept-gap");
      const gap = gapEl ? gapEl.textContent : "Pending Analysis";

      let weakestSubject = "N/A";
      let weakestScore = 100;
      Object.entries(subjectStats).forEach(([subj, data]) => {
        const avg = data.totalScore / data.count;
        if (avg < weakestScore) {
          weakestScore = avg;
          weakestSubject = `${subj} (${avg.toFixed(1)}%)`;
        }
      });

      // Construct Prompt (verbatim)
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

      // Call Gemini API
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(
          errData.error?.message || "Failed to fetch AI response"
        );
      }

      const data = await response.json();
      const aiText = data.candidates[0].content.parts[0].text;

      // Render Response using marked for full Markdown support
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
        html: `<p class="text-danger">Failed to generate review. Please check the system configuration.</p>`,
        error: true,
      });
    }
  }, [g]);

  const switchDashboardMode = (mode) => {
    g.currentDashboardMode = mode;
    setDashMode(mode);
  };

  return (
    <section id="dashboard-section" className="py-5" style={{ minHeight: "90vh" }}>
      <div className="container">
        <div className="text-center mb-5">
          <h2 className="fw-bold section-title">My Dashboard</h2>
          <div className="title-underline mx-auto"></div>
        </div>

        {/* Top metric row */}
        <div className="row row-cols-1 row-cols-md-3 row-cols-lg-5 g-3 mb-5 justify-content-center">
          <StatCard border="border-primary" label="Tests Taken" valueClass="text-primary" value={totalTests} />
          <StatCard border="border-warning" label="Avg. Score" valueClass="text-warning" value={avgScore + "%"} />
          <StatCard border="border-success" label="Precision" valueClass="text-success" value={precisionRate + "%"} sub="Net Accuracy" />
          <StatCard border="border-danger" label="Neg. Drain" valueClass="text-danger" value={negativeDrain + "%"} sub="Marks Lost" />
          <div className="col">
            <div className={`p-3 stat-card rounded shadow-sm border-start border-4 h-100 ${conceptGap.cls}`}>
              <h6 className="text-muted text-uppercase small fw-bold">Concept Gap</h6>
              <h2 className="fw-bold text-info mb-0" id="stat-concept-gap">
                {conceptGap.text}
              </h2>
              <small className="text-muted">Easy Qs Missed</small>
            </div>
          </div>
        </div>

        {/* Question totals row */}
        <div className="row row-cols-1 row-cols-md-5 g-3 mb-5 justify-content-center">
          <BottomStat border="border-dark" label="Total Qs" value={totalQs} />
          <BottomStat border="border-primary" label="Attempted" valueClass="text-primary" value={totalAttempted} />
          <BottomStat border="border-secondary" label="Unattempted" valueClass="text-secondary" value={Math.max(0, totalUnattempted)} />
          <BottomStat border="border-success" label="Correct" valueClass="text-success" value={totalCorrect} />
          <BottomStat border="border-danger" label="Incorrect" valueClass="text-danger" value={totalIncorrect} />
        </div>

        {/* Action cards */}
        <div className="row justify-content-center mb-4">
          <div className="col-md-6">
            <div
              className="card topic-card shadow-sm h-100 action-card"
              style={{ cursor: "pointer" }}
              onClick={showTestSelection}
              role="button"
              tabIndex={0}
              aria-label="Take Test"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  showTestSelection();
                }
              }}
            >
              <div className="card-body text-center p-4">
                <div className="display-5 mb-2">🚀</div>
                <h3 className="fw-bold card-title text-success m-0">Take Test</h3>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div
              className="card topic-card shadow-sm h-100 action-card"
              style={{ cursor: "pointer" }}
              onClick={startPracticeSelection}
              role="button"
              tabIndex={0}
              aria-label="Practice MCQ"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  startPracticeSelection();
                }
              }}
            >
              <div className="card-body text-center p-4">
                <div className="display-5 mb-2">🎯</div>
                <h3 className="fw-bold card-title text-info m-0">Practice MCQ</h3>
              </div>
            </div>
          </div>
        </div>

        {/* AI Mentor */}
        <div className="row justify-content-center mb-5">
          <div className="col-12">
            <div
              className="card border-0 shadow-sm rounded-4 p-4"
              style={{
                background:
                  "linear-gradient(135deg, var(--bg-card) 0%, var(--option-hover) 100%)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold text-primary mb-0">✨ AI Personalized Mentor</h5>
                <span className="badge bg-primary rounded-pill">Gemini</span>
              </div>

              <div id="ai-review-content" className="mb-3 text-muted">
                {aiState.html ? (
                  <div dangerouslySetInnerHTML={{ __html: aiState.html }} />
                ) : (
                  <p>
                    Get a personalized performance review powered by Google
                    Gemini AI. Analyze your weak spots, negative marking
                    patterns, and confidence gaps.
                  </p>
                )}
              </div>

              <div className="d-flex gap-2 align-items-center">
                <button
                  className="btn btn-primary-custom px-4"
                  onClick={generateAIReview}
                  id="btn-generate-ai"
                  disabled={aiState.loading}
                >
                  {aiState.loading && (
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                  )}
                  <span id="ai-btn-text">
                    {aiState.loading ? "Analyzing..." : "⚡ Analyze My Performance"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="row justify-content-center mb-4">
          <div className="col-12 text-center">
            <div className="btn-group shadow-sm" role="group" aria-label="Chart Data Source">
              <input
                type="radio"
                className="btn-check"
                name="dashMode"
                id="mode-quiz"
                autoComplete="off"
                checked={dashMode === "quiz"}
                onChange={() => switchDashboardMode("quiz")}
              />
              <label className="btn btn-outline-primary px-4 fw-bold" htmlFor="mode-quiz">
                Tests Analysis
              </label>

              <input
                type="radio"
                className="btn-check"
                name="dashMode"
                id="mode-practice"
                autoComplete="off"
                checked={dashMode === "practice"}
                onChange={() => switchDashboardMode("practice")}
              />
              <label className="btn btn-outline-primary px-4 fw-bold" htmlFor="mode-practice">
                Practice Analysis
              </label>
            </div>
          </div>
        </div>

        {/* Confidence chart */}
        <div className="row justify-content-center mb-5">
          <div className="col-12">
            <div className="card border-0 shadow-sm rounded-4 p-4">
              <h5 className="fw-bold text-primary mb-3">🎯 Overall Confidence Analysis</h5>
              <div style={{ position: "relative", height: 300, width: "100%" }}>
                <canvas id="globalConfidenceChart" ref={confChartRef}></canvas>
              </div>
              <p className="small text-muted mt-3 text-center">
                Aggregate accuracy across all recent tests categorized by
                confidence level.
              </p>
            </div>
          </div>
        </div>

        {/* Accuracy trend */}
        <div className="row justify-content-center mb-5">
          <div className="col-12">
            <div className="card border-0 shadow-sm rounded-4 p-4">
              <h5 className="fw-bold text-primary mb-3">📈 Accuracy Trend</h5>
              <div style={{ position: "relative", height: 300, width: "100%" }}>
                <canvas id="performanceChart" ref={perfChartRef}></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({ border, label, value, valueClass = "", sub }) {
  return (
    <div className="col">
      <div className={`p-3 stat-card rounded shadow-sm border-start border-4 ${border} h-100`}>
        <h6 className="text-muted text-uppercase small fw-bold">{label}</h6>
        <h2 className={`fw-bold mb-0 ${valueClass}`}>{value}</h2>
        {sub && <small className="text-muted">{sub}</small>}
      </div>
    </div>
  );
}

function BottomStat({ border, label, value, valueClass = "" }) {
  return (
    <div className="col">
      <div className={`p-3 stat-card rounded shadow-sm border-bottom border-4 ${border} h-100`}>
        <h6 className="text-muted text-uppercase small fw-bold">{label}</h6>
        <h2 className={`fw-bold mb-0 ${valueClass}`}>{value}</h2>
      </div>
    </div>
  );
}
