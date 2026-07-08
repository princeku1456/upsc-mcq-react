/* =========================================
   REVIEW MODE (ported from quiz.js:
   renderReviewMode / renderReviewQuestions / filterReview /
   filterReviewBySubject / loadLeaderboard / renderLeaderboardHTML)
   Every stat calculation, threshold and chart config is unchanged.
   The imperative innerHTML/DOM code is expressed as React markup;
   the three charts (subjectSpiderChart, comparisonChart,
   confidenceChart) are still built with the verbatim Chart.js
   configs and re-render on theme change.
   ========================================= */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../store";
import { DataManager } from "../lib/dataManager";
import { getCorrectIndex, TextFormatter, DifficultyHelper } from "../lib/helpers";
import { Chart, ChartHelper } from "../lib/chartHelper";

const SUBJECT_KEYS = [
  "Polity",
  "Economy",
  "History",
  "Geography",
  "Environment",
  "Science and Tech",
  "IR",
];

export default function ReviewMode({
  quizData,
  userAnswers,
  questionTimeSpent,
  resultData,
  chapterId,
  chapterName,
  onExit,
}) {
  const { currentUser, theme } = useApp();

  const [reviewStats, setReviewStats] = useState(null); // currentReviewStats
  const [statsLoading, setStatsLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState(null); // null=loading
  const [statusFilter, setStatusFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  const spiderRef = useRef(null);
  const comparisonRef = useRef(null);
  const confidenceRef = useRef(null);
  const spiderChartInst = useRef(null);
  const comparisonChartInst = useRef(null);
  const confidenceChartInst = useRef(null);

  /* ---- Pre-fetch global stats (verbatim gating on revision_) ---- */
  useEffect(() => {
    let cancelled = false;
    async function run() {
      let stats = null;
      if (!chapterId.startsWith("revision_")) {
        stats = await DataManager.fetchGlobalStats(chapterId);
      }
      if (cancelled) return;
      setReviewStats(stats);
      setStatsLoading(false);

      // loadLeaderboard(currentChapterId)
      if (stats && stats.leaderboard) setLeaderboard(stats.leaderboard);
      else setLeaderboard([]);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  /* =========================================
     Core computation (verbatim from renderReviewMode)
     ========================================= */
  const computed = useMemo(() => {
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

    quizData.forEach((q, i) => {
      const uAns = userAnswers[i];
      const correctIndex = getCorrectIndex(q);

      if (q.subject) {
        const qSubj = q.subject.trim();
        let matchedSubj = Object.keys(subjectStats).find(
          (sName) => sName.toLowerCase() === qSubj.toLowerCase()
        );
        if (!matchedSubj && subjectStats[qSubj]) matchedSubj = qSubj;
        if (matchedSubj) {
          subjectStats[matchedSubj].total++;
          if (!uAns) subjectStats[matchedSubj].unattempted++;
          else if (uAns.answer === correctIndex) subjectStats[matchedSubj].correct++;
          else subjectStats[matchedSubj].incorrect++;
        }
      }

      const commCorrect = reviewStats?.correctCounts?.[i] || 0;
      const commTotal = reviewStats?.totalAttempts || 0;
      const diffInfo = DifficultyHelper.calculate(commCorrect, commTotal);
      const diffLabel = diffInfo.label;

      difficultyStats[diffLabel].total++;
      if (!uAns) difficultyStats[diffLabel].unattempted++;
      else if (uAns.answer === correctIndex) difficultyStats[diffLabel].correct++;
      else difficultyStats[diffLabel].incorrect++;

      const confidence = uAns?.surety;
      if (uAns && confidence !== undefined) {
        confStats[confidence].total++;
        if (uAns.answer === getCorrectIndex(q)) confStats[confidence].correct++;
      }

      if (!uAns) {
        unattempted++;
      } else if (uAns.answer === correctIndex) {
        correct++;
        if (diffLabel === "Hard") hardSuccess++;
      } else {
        incorrect++;
        if (diffLabel === "Easy") {
          sillyMistakes++;
          missedEasyQNumbers.push(`Q${i + 1}`);
        }
      }
    });

    const confChartValues = [
      confStats[100].total > 0
        ? ((confStats[100].correct / confStats[100].total) * 100).toFixed(1)
        : 0,
      confStats[75].total > 0
        ? ((confStats[75].correct / confStats[75].total) * 100).toFixed(1)
        : 0,
      confStats[50].total > 0
        ? ((confStats[50].correct / confStats[50].total) * 100).toFixed(1)
        : 0,
      confStats[0].total > 0
        ? ((confStats[0].correct / confStats[0].total) * 100).toFixed(1)
        : 0,
    ];

    const totalQuestions = quizData.length;
    const attempted = correct + incorrect;
    const score = resultData
      ? resultData.score
      : (correct * 2 - incorrect * 0.66).toFixed(2);
    const totalMarks = totalQuestions * 2;
    const marksLost = (incorrect * 0.66).toFixed(2);
    const accuracyRate = ((correct / (correct + incorrect)) * 100 || 0).toFixed(1);

    const hasSubjectStats = Object.values(subjectStats).some((st) => st.total > 0);

    return {
      confStats,
      confChartValues,
      correct,
      incorrect,
      unattempted,
      sillyMistakes,
      hardSuccess,
      missedEasyQNumbers,
      difficultyStats,
      subjectStats,
      totalQuestions,
      attempted,
      score,
      totalMarks,
      marksLost,
      accuracyRate,
      hasSubjectStats,
    };
  }, [quizData, userAnswers, resultData, reviewStats]);

  /* =========================================
     Chart: subjectSpiderChart (verbatim config)
     ========================================= */
  useEffect(() => {
    if (statsLoading) return;
    if (!computed.hasSubjectStats || !spiderRef.current) return;

    const subjectNames = [];
    const accuracies = [];
    const correctAttempts = [];
    const incorrectAttempts = [];
    const unattemptedQs = [];

    Object.keys(computed.subjectStats).forEach((subject) => {
      const stats = computed.subjectStats[subject];
      if (stats.total > 0) {
        subjectNames.push(subject);
        const attempted = stats.correct + stats.incorrect;
        const acc = attempted > 0 ? ((stats.correct / attempted) * 100).toFixed(1) : 0;
        accuracies.push(acc);
        correctAttempts.push(stats.correct);
        incorrectAttempts.push(stats.incorrect);
        unattemptedQs.push(stats.unattempted);
      }
    });

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const textColor = isDark ? "#e5e7eb" : "#666";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";

    if (spiderChartInst.current) spiderChartInst.current.destroy();
    spiderChartInst.current = new Chart(spiderRef.current, {
      type: "bar",
      data: {
        labels: subjectNames,
        datasets: [
          {
            type: "line",
            label: "Accuracy (%)",
            data: accuracies,
            borderColor: "rgba(59, 130, 246, 1)",
            backgroundColor: "rgba(59, 130, 246, 1)",
            pointBackgroundColor: "rgba(59, 130, 246, 1)",
            pointBorderColor: "#fff",
            pointHoverBackgroundColor: "#fff",
            pointHoverBorderColor: "rgba(59, 130, 246, 1)",
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: false,
            yAxisID: "y1",
          },
          {
            type: "bar",
            label: "Correct Qs",
            data: correctAttempts,
            backgroundColor: "rgba(16, 185, 129, 0.8)",
            borderColor: "rgba(16, 185, 129, 1)",
            borderWidth: 1,
            yAxisID: "y",
          },
          {
            type: "bar",
            label: "Incorrect Qs",
            data: incorrectAttempts,
            backgroundColor: "rgba(239, 68, 68, 0.8)",
            borderColor: "rgba(239, 68, 68, 1)",
            borderWidth: 1,
            yAxisID: "y",
          },
          {
            type: "bar",
            label: "Unattempted Qs",
            data: unattemptedQs,
            backgroundColor: "rgba(250, 204, 21, 0.8)",
            borderColor: "rgba(250, 204, 21, 1)",
            borderWidth: 1,
            borderRadius: { topLeft: 4, topRight: 4 },
            yAxisID: "y",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: textColor, font: { family: "'Poppins', sans-serif" } },
          },
          y: {
            stacked: true,
            type: "linear",
            display: true,
            position: "left",
            title: {
              display: true,
              text: "Questions Count",
              color: textColor,
              font: { size: 10 },
            },
            grid: { color: gridColor, drawBorder: false },
            ticks: { color: textColor, precision: 0 },
          },
          y1: {
            type: "linear",
            display: true,
            position: "right",
            title: {
              display: true,
              text: "Accuracy (%)",
              color: "rgba(59, 130, 246, 1)",
              font: { size: 10 },
            },
            grid: { drawOnChartArea: false },
            ticks: {
              color: "rgba(59, 130, 246, 1)",
              suggestedMin: 0,
              suggestedMax: 100,
              stepSize: 20,
            },
          },
        },
        plugins: {
          legend: {
            position: "top",
            labels: { color: textColor, usePointStyle: true, boxWidth: 8 },
          },
          tooltip: {
            backgroundColor: isDark ? "rgba(30, 41, 59, 0.95)" : "rgba(255, 255, 255, 0.95)",
            titleColor: isDark ? "#f8fafc" : "#0f172a",
            bodyColor: isDark ? "#cbd5e1" : "#334155",
            borderColor: isDark ? "#334155" : "#e2e8f0",
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              label: function (context) {
                let label = context.dataset.label || "";
                if (label) label += ": ";
                if (context.parsed.y !== null) {
                  label += context.parsed.y;
                  if (context.datasetIndex === 0) label += "%";
                }
                return label;
              },
            },
          },
        },
      },
    });

    return () => {
      if (spiderChartInst.current) {
        spiderChartInst.current.destroy();
        spiderChartInst.current = null;
      }
    };
  }, [statsLoading, computed, theme]);

  /* =========================================
     Chart: comparisonChart (global comparison, verbatim)
     ========================================= */
  const percentile = useMemo(() => {
    const stats = reviewStats;
    if (!stats) return null;
    const myScore = resultData ? resultData.scorePercent : 0;
    let betterThan = 0;
    for (let i = 0; i < stats.allScores.length; i++) {
      if (stats.allScores[i] < myScore) betterThan++;
    }
    return stats.totalAttempts > 0
      ? ((betterThan / stats.totalAttempts) * 100).toFixed(0)
      : 0;
  }, [reviewStats, resultData]);

  useEffect(() => {
    if (statsLoading || !reviewStats || !comparisonRef.current) return;
    const stats = reviewStats;
    const myScore = resultData ? resultData.scorePercent : 0;
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const textColor = isDark ? "#e5e7eb" : "#666";

    if (comparisonChartInst.current) comparisonChartInst.current.destroy();
    comparisonChartInst.current = new Chart(comparisonRef.current, {
      type: "bar",
      data: {
        labels: ["Global Avg", "Your Score", "Topper"],
        datasets: [
          {
            label: "Score (%)",
            data: [stats.avg.toFixed(1), myScore.toFixed(1), stats.highest.toFixed(1)],
            backgroundColor: [
              "rgba(108, 117, 125, 0.5)",
              "rgba(59, 130, 246, 0.8)",
              "rgba(245, 158, 11, 0.8)",
            ],
            borderColor: [
              "rgba(108, 117, 125, 1)",
              "rgba(30, 58, 138, 1)",
              "rgba(245, 158, 11, 1)",
            ],
            borderWidth: 1,
            borderRadius: 5,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            grid: { display: false },
            ticks: { color: textColor },
          },
          y: { grid: { display: false }, ticks: { color: textColor } },
        },
      },
    });

    return () => {
      if (comparisonChartInst.current) {
        comparisonChartInst.current.destroy();
        comparisonChartInst.current = null;
      }
    };
  }, [statsLoading, reviewStats, resultData, theme]);

  /* =========================================
     Chart: confidenceChart (verbatim ChartHelper call)
     ========================================= */
  useEffect(() => {
    if (statsLoading || !confidenceRef.current) return;
    if (confidenceChartInst.current) confidenceChartInst.current.destroy();
    confidenceChartInst.current = ChartHelper.renderConfidenceChart(
      confidenceRef.current,
      computed.confChartValues,
      computed.confStats
    );
    return () => {
      if (confidenceChartInst.current) {
        confidenceChartInst.current.destroy();
        confidenceChartInst.current = null;
      }
    };
  }, [statsLoading, computed, theme]);

  /* =========================================
     RENDER
     ========================================= */
  const {
    correct,
    incorrect,
    unattempted,
    sillyMistakes,
    hardSuccess,
    missedEasyQNumbers,
    difficultyStats,
    subjectStats,
    totalQuestions,
    attempted,
    score,
    totalMarks,
    marksLost,
    accuracyRate,
    hasSubjectStats,
  } = computed;

  return (
    <div id="quiz-content">
      {/* Header + filters */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2 border-bottom pb-3">
        <div>
          <h4 className="fw-bold text-primary m-0">{chapterName}</h4>
          <span className="badge bg-secondary">Performance Review</span>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {hasSubjectStats && (
            <select
              className="form-select w-auto shadow-sm"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
            >
              <option value="all">All Subjects</option>
              {Object.keys(subjectStats).map((subject) =>
                subjectStats[subject].total > 0 ? (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ) : null
              )}
            </select>
          )}
          <div className="btn-group shadow-sm" role="group">
            <button
              className={`btn btn-outline-primary ${statusFilter === "all" ? "active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              All
            </button>
            <button
              className={`btn btn-outline-success ${statusFilter === "correct" ? "active" : ""}`}
              onClick={() => setStatusFilter("correct")}
            >
              Correct
            </button>
            <button
              className={`btn btn-outline-danger ${statusFilter === "incorrect" ? "active" : ""}`}
              onClick={() => setStatusFilter("incorrect")}
            >
              Incorrect
            </button>
            <button
              className={`btn btn-outline-secondary ${
                statusFilter === "unattempted" ? "active" : ""
              }`}
              onClick={() => setStatusFilter("unattempted")}
            >
              Unattempted
            </button>
          </div>
        </div>
      </div>

      {/* UPSC Prep Index */}
      <div className="card mb-4 border-0 shadow-sm">
        <div className="card-body">
          <h5 className="fw-bold card-title mb-3">📊 UPSC Prep Index</h5>

          <div className="row g-3 text-center mb-4">
            <div className="col-6 col-md-3">
              <div className="p-3 bg-white rounded shadow-sm border-start border-4 border-primary">
                <h6 className="text-uppercase text-muted small fw-bold mb-1">Accuracy</h6>
                <h3 className="fw-bold text-dark m-0">{accuracyRate}%</h3>
                <small className="text-muted">on attempted</small>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="p-3 bg-white rounded shadow-sm border-start border-4 border-danger">
                <h6 className="text-uppercase text-muted small fw-bold mb-1">Negative Loss</h6>
                <h3 className="fw-bold text-danger m-0">-{marksLost}</h3>
                <small className="text-muted">marks lost</small>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="p-3 bg-white rounded shadow-sm border-start border-4 border-warning">
                <h6 className="text-uppercase text-muted small fw-bold mb-1">Concept Gaps</h6>
                <h3 className="fw-bold text-warning m-0">{sillyMistakes}</h3>
                <small className="text-muted d-block">
                  {missedEasyQNumbers.length > 0 ? (
                    <>
                      Easy Qs Missed --{" "}
                      <span className="text-danger fw-bold">
                        &quot;{missedEasyQNumbers.join(", ")}&quot;
                      </span>
                    </>
                  ) : (
                    "No Easy Qs Missed"
                  )}
                </small>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="p-3 bg-primary text-white rounded shadow-sm">
                <h6 className="text-white-50 text-uppercase small fw-bold mb-1">Final Score</h6>
                <h3 className="fw-bold m-0">
                  {score} <span className="fs-6 text-white-50">/ {totalMarks}</span>
                </h3>
              </div>
            </div>
          </div>

          <div className="row g-2 mb-4 text-center">
            <div className="col-4 col-md">
              <div className="p-2 border rounded bg-light">
                <small className="text-muted d-block small fw-bold">TOTAL Qs</small>
                <span className="fw-bold">{totalQuestions}</span>
              </div>
            </div>
            <div className="col-4 col-md">
              <div className="p-2 border rounded bg-light">
                <small className="text-muted d-block small fw-bold">ATTEMPTED</small>
                <span className="fw-bold text-primary">{attempted}</span>
              </div>
            </div>
            <div className="col-4 col-md">
              <div className="p-2 border rounded bg-light">
                <small className="text-muted d-block small fw-bold">UNATTEMPTED</small>
                <span className="fw-bold text-secondary">{unattempted}</span>
              </div>
            </div>
            <div className="col-6 col-md">
              <div className="p-2 border rounded bg-light border-success-subtle">
                <small className="text-success d-block small fw-bold">CORRECT</small>
                <span className="fw-bold text-success">{correct}</span>
              </div>
            </div>
            <div className="col-6 col-md">
              <div className="p-2 border rounded bg-light border-danger-subtle">
                <small className="text-danger d-block small fw-bold">INCORRECT</small>
                <span className="fw-bold text-danger">{incorrect}</span>
              </div>
            </div>
          </div>

          {/* Difficulty Matrix */}
          <div className="card mb-4 border-0 shadow-sm">
            <div className="card-header bg-white border-bottom py-2">
              <h6 className="fw-bold text-primary m-0">🎯 Performance by Difficulty</h6>
            </div>
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead className="table-light small text-muted">
                  <tr>
                    <th>Difficulty</th>
                    <th className="text-center">Total</th>
                    <th className="text-center">Correct</th>
                    <th className="text-center">Incorrect</th>
                    <th className="text-center">Unattempted</th>
                    <th className="text-end">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {["Easy", "Medium", "Hard"].map((level) => {
                    const stats = difficultyStats[level];
                    const att = stats.correct + stats.incorrect;
                    const acc = att > 0 ? ((stats.correct / att) * 100).toFixed(1) : 0;
                    let badgeClass = "bg-secondary";
                    if (level === "Easy") badgeClass = "bg-success";
                    if (level === "Medium") badgeClass = "bg-warning text-dark";
                    if (level === "Hard") badgeClass = "bg-danger";
                    return (
                      <tr key={level}>
                        <td>
                          <span className={`badge ${badgeClass}`}>{level}</span>
                        </td>
                        <td className="text-center">{stats.total}</td>
                        <td className="text-center text-success fw-bold">{stats.correct}</td>
                        <td className="text-center text-danger fw-bold">{stats.incorrect}</td>
                        <td className="text-center text-muted">{stats.unattempted}</td>
                        <td className="text-end fw-bold">{acc}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Subject Matrix + Spider Chart */}
          {hasSubjectStats && (
            <div className="card mb-4 border-0 shadow-sm">
              <div className="card-header bg-white border-bottom py-2">
                <h6 className="fw-bold text-primary m-0">📚 Subject-wise Performance</h6>
              </div>
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead className="table-light small text-muted">
                    <tr>
                      <th>Subject</th>
                      <th className="text-center">Total</th>
                      <th className="text-center">Correct</th>
                      <th className="text-center">Incorrect</th>
                      <th className="text-center">Unattempted</th>
                      <th className="text-end">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(subjectStats).map((subject) => {
                      const stats = subjectStats[subject];
                      if (stats.total === 0) return null;
                      const att = stats.correct + stats.incorrect;
                      const acc = att > 0 ? ((stats.correct / att) * 100).toFixed(1) : 0;
                      return (
                        <tr key={subject}>
                          <td>
                            <span className="badge bg-secondary">{subject}</span>
                          </td>
                          <td className="text-center">{stats.total}</td>
                          <td className="text-center text-success fw-bold">{stats.correct}</td>
                          <td className="text-center text-danger fw-bold">{stats.incorrect}</td>
                          <td className="text-center text-muted">{stats.unattempted}</td>
                          <td className="text-end fw-bold">{acc}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div
                className="card-body border-top text-center"
                style={{ maxHeight: "400px", display: "flex", justifyContent: "center" }}
              >
                <canvas
                  ref={spiderRef}
                  style={{ maxHeight: "350px", width: "100%", maxWidth: "500px" }}
                ></canvas>
              </div>
            </div>
          )}

          {/* Strategy insight / Competitive edge */}
          <div className="row mb-4 g-3">
            <div className="col-md-6">
              <div className="alert alert-info border-0 shadow-sm h-100">
                <h6 className="fw-bold">
                  <i className="fas fa-lightbulb me-2"></i>Strategy Insight
                </h6>
                <p className="small mb-0">
                  {accuracyRate < 70
                    ? "Your accuracy is below threshold. Focus on elimination techniques."
                    : "Good precision. You are making calculated attempts."}{" "}
                  {sillyMistakes > 2 ? (
                    <>
                      You missed <strong>{sillyMistakes} basic questions</strong> that 65% of
                      students got right. Tighten your fundamentals.
                    </>
                  ) : (
                    "You handled the 'easy' questions with professional precision."
                  )}
                </p>
              </div>
            </div>
            <div className="col-md-6">
              <div className="alert alert-success border-0 shadow-sm h-100">
                <h6 className="fw-bold">
                  <i className="fas fa-trophy me-2"></i>Competitive Edge
                </h6>
                <p className="small mb-0">
                  You solved <strong>{hardSuccess} high-difficulty</strong> questions where the
                  community struggled. This indicates depth in complex topics.
                </p>
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="mb-4">
            {leaderboard === null ? (
              <div className="text-center py-3">
                <span className="spinner-border spinner-border-sm text-primary"></span> Loading
                Leaderboard...
              </div>
            ) : (
              <LeaderboardTable data={leaderboard} currentUser={currentUser} />
            )}
          </div>

          {/* Global comparison */}
          <div className="row align-items-center pt-3 border-top">
            {statsLoading ? (
              <div className="col-12 text-center py-3">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="text-muted small mt-2">Comparing with other students...</p>
              </div>
            ) : !reviewStats ? (
              <div className="col-12 text-center text-muted">
                Not enough data for global comparison yet.
              </div>
            ) : (
              <>
                <div className="col-md-4 mb-3 mb-md-0 text-center">
                  <h6 className="text-uppercase text-muted small fw-bold">Your Rank</h6>
                  <h2 className="fw-bold text-primary">Top {100 - percentile}%</h2>
                  <p className="small text-muted">Better than {percentile}% of users</p>
                </div>
                <div className="col-md-8">
                  <div style={{ height: "200px", width: "100%" }}>
                    <canvas ref={comparisonRef}></canvas>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Confidence chart */}
          <div className="mb-5 mt-5 p-3 rounded border bg-white">
            <h6 className="fw-bold text-secondary mb-3">
              <i className="bi bi-graph-up-arrow me-2"></i>Confidence vs Accuracy Analysis
            </h6>
            <div style={{ height: "250px", width: "100%" }}>
              <canvas ref={confidenceRef}></canvas>
            </div>
            <p className="small text-muted mt-2 text-center">
              Correct attempts as a % of each confidence level.
            </p>
          </div>
        </div>
      </div>

      {/* Question cards */}
      <ReviewQuestions
        quizData={quizData}
        userAnswers={userAnswers}
        questionTimeSpent={questionTimeSpent}
        reviewStats={reviewStats}
        statusFilter={statusFilter}
        subjectFilter={subjectFilter}
      />

      <div className="text-center mt-5">
        <button className="btn btn-primary-custom px-5 shadow py-2" onClick={onExit}>
          ← Back
        </button>
      </div>
    </div>
  );
}

/* ---------- Leaderboard (renderLeaderboardHTML port) ---------- */
function LeaderboardTable({ data, currentUser }) {
  if (!data || data.length === 0) {
    return (
      <div className="alert alert-light border text-center text-muted small">
        No other attempts yet. Be the first!
      </div>
    );
  }

  const uniqueUsers = {};
  data.forEach((entry) => {
    const email = entry.userEmail || "Guest";
    if (!uniqueUsers[email] || entry.scorePercent > uniqueUsers[email].scorePercent) {
      uniqueUsers[email] = entry;
    }
  });
  const filteredSortedData = Object.values(uniqueUsers).sort(
    (a, b) => b.scorePercent - a.scorePercent
  );

  let rank = 1;
  return (
    <div className="card border-0 shadow-sm overflow-hidden mt-3">
      <div className="card-header bg-white border-bottom py-2">
        <div className="d-flex justify-content-between align-items-center">
          <h6 className="fw-bold text-primary m-0">🏆 Leaderboard</h6>
          <small className="text-muted">Top Students</small>
        </div>
      </div>
      <div className="table-responsive">
        <table className="table table-hover mb-0 align-middle" style={{ fontSize: "0.9rem" }}>
          <tbody className="bg-white">
            {filteredSortedData.map((entry, idx) => {
              const email = entry.userEmail || "Guest";
              const rawName = email.split("@")[0];
              const displayName =
                rawName.length > 3 ? rawName.substring(0, 3) + "***" : rawName;
              const isMe = currentUser && entry.userEmail === currentUser.email;
              const currentRank = rank++;
              return (
                <tr key={idx} className={isMe ? "table-warning fw-bold" : ""}>
                  <td className="ps-3 text-secondary">#{currentRank}</td>
                  <td>
                    <div className="d-flex align-items-center">
                      <div
                        className="rounded-circle bg-secondary text-white d-flex justify-content-center align-items-center me-2 shadow-sm"
                        style={{ width: "24px", height: "24px", fontSize: "10px" }}
                      >
                        {rawName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-dark">{displayName}</span>
                      {isMe && (
                        <span
                          className="badge bg-warning text-dark dummy-tag ms-2"
                          style={{ fontSize: "0.6rem" }}
                        >
                          YOU
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-end pe-3">
                    <span
                      className={`badge ${
                        entry.scorePercent >= 80 ? "bg-success" : "bg-primary"
                      }`}
                    >
                      {entry.scorePercent}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Review question cards (renderReviewQuestions port) ---------- */
function ReviewQuestions({
  quizData,
  userAnswers,
  questionTimeSpent,
  reviewStats,
  statusFilter,
  subjectFilter,
}) {
  const cards = quizData.map((question, index) => {
    const correctIndex = getCorrectIndex(question);
    const uAns = userAnswers[index];
    const userSurety = uAns?.surety !== undefined ? uAns.surety : "N/A";

    let status = "unattempted";
    if (uAns) status = uAns.answer === correctIndex ? "correct" : "incorrect";

    let borderClass = "";
    let suretyClass = "surety-0";
    if (userSurety === 100) suretyClass = "surety-100";
    else if (userSurety === 75) suretyClass = "surety-75";
    else if (userSurety === 50) suretyClass = "surety-50";

    let badge = null;
    if (status === "correct") {
      badge = <span className="badge bg-success mb-2">Correct</span>;
      borderClass = "border-success";
    } else if (status === "incorrect") {
      badge = <span className="badge bg-danger mb-2">Incorrect</span>;
      borderClass = "border-danger";
    } else {
      badge = <span className="badge bg-secondary mb-2">Unattempted</span>;
      borderClass = "border-secondary";
    }

    const commTotal = reviewStats?.totalAttempts || 0;
    const commCorrect = reviewStats?.correctCounts?.[index] || 0;
    const diffInfo = DifficultyHelper.calculate(commCorrect, commTotal);

    let statsBlock = null;
    if (reviewStats && reviewStats.totalAttempts > 0) {
      const total = reviewStats.totalAttempts;
      const correctCount = commCorrect;
      const attemptedCount =
        (reviewStats.attemptedCounts && reviewStats.attemptedCounts[index]) || 0;
      const pCorrect = Math.round((correctCount / total) * 100);
      const pIncorrect = Math.round(((attemptedCount - correctCount) / total) * 100);
      const pUnattempted = 100 - pCorrect - pIncorrect;

      statsBlock = (
        <div className="mt-2 mb-4 p-3 bg-light bg-opacity-75 rounded-3 border">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span
              className="small fw-bold text-uppercase text-secondary"
              style={{ letterSpacing: "0.5px" }}
            >
              👥 Community Stats
            </span>
            <span className="fw-bold" style={{ color: "#4338ca" }}>
              {pCorrect}% Correct
            </span>
          </div>
          <div
            className="progress shadow-sm"
            style={{
              height: "40px",
              backgroundColor: "#e2e8f0",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <div
              className="progress-bar stats-bar-correct d-flex align-items-center justify-content-center"
              role="progressbar"
              style={{ width: `${pCorrect}%` }}
            >
              <span className="progress-bar-text">{pCorrect > 12 ? pCorrect + "%" : ""}</span>
            </div>
            <div
              className="progress-bar stats-bar-incorrect d-flex align-items-center justify-content-center"
              role="progressbar"
              style={{ width: `${pIncorrect}%` }}
            >
              <span className="progress-bar-text">
                {pIncorrect > 12 ? pIncorrect + "%" : ""}
              </span>
            </div>
            <div
              className="progress-bar stats-bar-left d-flex align-items-center justify-content-center"
              role="progressbar"
              style={{ width: `${pUnattempted}%` }}
            >
              <span className="progress-bar-text">
                {pUnattempted > 12 ? pUnattempted + "%" : ""}
              </span>
            </div>
          </div>
          <div className="d-flex justify-content-between align-items-center mb-2 mt-2">
            <span className="fw-bold" style={{ color: "#4338ca" }}>
              Total test taken by: {total}
            </span>
          </div>
        </div>
      );
    }

    const timeSec =
      questionTimeSpent && questionTimeSpent[index]
        ? Math.round(questionTimeSpent[index])
        : 0;
    const timeLabel =
      timeSec < 60 ? `${timeSec}s` : `${Math.floor(timeSec / 60)}m ${timeSec % 60}s`;

    // Visibility (verbatim matchStatus/matchSubject)
    const cardSubject = question.subject || "";
    const matchStatus = statusFilter === "all" || status === statusFilter;
    const matchSubject = subjectFilter === "all" || cardSubject === subjectFilter;
    const hidden = !(matchStatus && matchSubject);

    return (
      <div
        key={index}
        className={`card mb-4 shadow-sm border-0 border-start border-5 ${borderClass} question-card ${
          hidden ? "d-none" : ""
        }`}
      >
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="d-flex align-items-center flex-wrap gap-2">
              <h6 className="text-muted fw-bold m-0 me-2">Question {index + 1}</h6>
              <span className={`surety-badge ${suretyClass}`}>Confidence: {userSurety}%</span>
              <span className="badge bg-light text-dark border ms-2">⏱ {timeLabel}</span>
              <span className={`badge bg-${diffInfo.color} mb-2 ms-2`}>{diffInfo.label}</span>
              {question.subject && (
                <span className="badge bg-success-subtle text-success ms-2">
                  📚 {question.subject}
                </span>
              )}
            </div>
            {badge}
          </div>
          {statsBlock}
          <div
            className="fs-5 fw-medium mb-3"
            dangerouslySetInnerHTML={{
              __html: TextFormatter.formatQuestionText(question.text),
            }}
          ></div>
          <div className="mb-3">
            {question.options.map((opt, optIdx) => {
              let optionClass = "option p-3 mb-2 border rounded";
              let icon = "";
              if (optIdx === correctIndex) {
                optionClass =
                  "option p-3 mb-2 border rounded bg-success-subtle border-success fw-bold text-success";
                icon = "✅";
              } else if (uAns && uAns.answer === optIdx && status === "incorrect") {
                optionClass =
                  "option p-3 mb-2 border rounded bg-danger-subtle border-danger text-danger";
                icon = "❌";
              }
              return (
                <div key={optIdx} className={optionClass}>
                  {icon} <span className="ms-1">{opt}</span>
                </div>
              );
            })}
          </div>
          <div className="explanation mt-3 shadow-sm">
            <strong>💡 Explanation:</strong>
            <div
              className="mt-1 small"
              dangerouslySetInnerHTML={{
                __html: question.explanation || "No explanation provided.",
              }}
            ></div>
          </div>
        </div>
      </div>
    );
  });

  const anyVisible = quizData.some((question, index) => {
    const uAns = userAnswers[index];
    let status = "unattempted";
    if (uAns) status = uAns.answer === getCorrectIndex(question) ? "correct" : "incorrect";
    const cardSubject = question.subject || "";
    const matchStatus = statusFilter === "all" || status === statusFilter;
    const matchSubject = subjectFilter === "all" || cardSubject === subjectFilter;
    return matchStatus && matchSubject;
  });

  return (
    <div id="review-container">
      {cards}
      {!anyVisible && (
        <div className="alert alert-info text-center mt-3 alert-info-no-questions">
          No questions found for this filter.
        </div>
      )}
    </div>
  );
}
