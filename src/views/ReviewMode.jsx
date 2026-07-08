/* =========================================
   REVIEW MODE (ported from quiz.js)
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

  const [reviewStats, setReviewStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  const spiderRef = useRef(null);
  const comparisonRef = useRef(null);
  const confidenceRef = useRef(null);
  const spiderChartInst = useRef(null);
  const comparisonChartInst = useRef(null);
  const confidenceChartInst = useRef(null);

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

      if (stats && stats.leaderboard) setLeaderboard(stats.leaderboard);
      else setLeaderboard([]);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [chapterId]);

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

  useEffect(() => {
    if (statsLoading || !reviewStats || computed.isRevision) return;

    if (spiderChartInst.current) { spiderChartInst.current.destroy(); spiderChartInst.current = null; }
    if (comparisonChartInst.current) { comparisonChartInst.current.destroy(); comparisonChartInst.current = null; }
    if (confidenceChartInst.current) { confidenceChartInst.current.destroy(); confidenceChartInst.current = null; }

    const isDark = theme === "dark";
    const tColor = isDark ? "#e2e8f0" : "#334155";
    const gColor = isDark ? "#334155" : "#e2e8f0";

    const radarLabels = [];
    const radarUserData = [];
    const radarCommData = [];

    const stats = reviewStats;
    SUBJECT_KEYS.forEach((subj) => {
      if (computed.subjectStats[subj].total > 0) {
        radarLabels.push(subj);
        const uSubTotal = computed.subjectStats[subj].total;
        const uSubCorrect = computed.subjectStats[subj].correct;
        radarUserData.push((uSubCorrect / uSubTotal) * 100);

        let commSubTotal = 0;
        let commSubCorrect = 0;
        quizData.forEach((q, idx) => {
          let qSubj = "Unknown";
          if (q.tags && q.tags.length > 0) {
            const subjTag = q.tags.find((t) => t.startsWith("subject:"));
            if (subjTag) qSubj = subjTag.replace("subject:", "").trim();
          }
          if (qSubj === subj) {
            commSubTotal += stats.totalAttempts || 0;
            commSubCorrect += stats.correctCounts ? stats.correctCounts[idx] : 0;
          }
        });
        radarCommData.push(commSubTotal > 0 ? (commSubCorrect / commSubTotal) * 100 : 0);
      }
    });

    if (spiderRef.current && radarLabels.length > 0) {
      spiderChartInst.current = new Chart(spiderRef.current, {
        type: "radar",
        data: {
          labels: radarLabels,
          datasets: [
            {
              label: "Your Accuracy (%)",
              data: radarUserData,
              backgroundColor: "rgba(59, 130, 246, 0.2)",
              borderColor: "#3b82f6",
              pointBackgroundColor: "#3b82f6",
              borderWidth: 2,
            },
            {
              label: "Community Accuracy (%)",
              data: radarCommData,
              backgroundColor: "rgba(107, 114, 128, 0.2)",
              borderColor: "#6b7280",
              pointBackgroundColor: "#6b7280",
              borderWidth: 2,
              borderDash: [5, 5],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              angleLines: { color: gColor },
              grid: { color: gColor },
              pointLabels: { color: tColor, font: { size: 12 } },
              ticks: { display: false, min: 0, max: 100 },
            },
          },
          plugins: { legend: { labels: { color: tColor } } },
        },
      });
    }

    const { confStats } = computed;
    const confLabels = ["100% (Sure)", "75% (Likely)", "50% (Maybe)", "0% (Guess)"];
    const confAccData = [];
    const confCounts = [
      confStats[100].total,
      confStats[75].total,
      confStats[50].total,
      confStats[0].total,
    ];

    [100, 75, 50, 0].forEach((level) => {
      const { total, correct } = confStats[level];
      confAccData.push(total > 0 ? (correct / total) * 100 : 0);
    });

    if (confidenceRef.current) {
      confidenceChartInst.current = new Chart(confidenceRef.current, {
        type: "bar",
        data: {
          labels: confLabels,
          datasets: [
            {
              label: "Accuracy (%)",
              data: confAccData,
              backgroundColor: "#10b981",
              borderRadius: 4,
              yAxisID: "y",
            },
            {
              label: "Questions Attempted",
              data: confCounts,
              type: "line",
              borderColor: "#f59e0b",
              backgroundColor: "#f59e0b",
              borderWidth: 2,
              pointRadius: 4,
              yAxisID: "y1",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { grid: { color: gColor }, ticks: { color: tColor } },
            y: {
              type: "linear",
              position: "left",
              min: 0,
              max: 100,
              grid: { color: gColor },
              ticks: { color: tColor },
              title: { display: true, text: "Accuracy (%)", color: tColor },
            },
            y1: {
              type: "linear",
              position: "right",
              min: 0,
              grid: { drawOnChartArea: false },
              ticks: { color: tColor, precision: 0 },
              title: { display: true, text: "Questions", color: tColor },
            },
          },
          plugins: { legend: { labels: { color: tColor } } },
        },
      });
    }

    const userP = (computed.finalScore / computed.totalMarks) * 100;
    const commAvgP = (stats.totalScore || 0) / (stats.totalAttempts || 1);
    const commHighP = stats.highestScore || 0;

    if (comparisonRef.current) {
      comparisonChartInst.current = new Chart(comparisonRef.current, {
        type: "bar",
        data: {
          labels: ["You", "Community Avg", "Highest Score"],
          datasets: [
            {
              label: "Score (%)",
              data: [userP, commAvgP, commHighP],
              backgroundColor: ["#3b82f6", "#6b7280", "#f59e0b"],
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { grid: { display: false }, ticks: { color: tColor } },
            y: { min: 0, max: 100, grid: { color: gColor }, ticks: { color: tColor } },
          },
          plugins: { legend: { display: false } },
        },
      });
    }

    return () => {
      if (spiderChartInst.current) spiderChartInst.current.destroy();
      if (comparisonChartInst.current) comparisonChartInst.current.destroy();
      if (confidenceChartInst.current) confidenceChartInst.current.destroy();
    };
  }, [statsLoading, reviewStats, computed, theme, quizData]);

  const uniqueSubjects = useMemo(() => {
    const s = new Set();
    quizData.forEach((q) => {
      if (q.tags) {
        const t = q.tags.find((tag) => tag.startsWith("subject:"));
        if (t) s.add(t.replace("subject:", "").trim());
      }
    });
    return Array.from(s).sort();
  }, [quizData]);

  return (
    <div className="review">
      <div className="dash__hero">
        <h1>{chapterName}</h1>
        <p>Review your test performance and analytics.</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <Stat
          variant={computed.finalScore >= 0 ? "leaf" : "stamp"}
          label="Score"
          value={`${computed.finalScore.toFixed(1)} / ${computed.totalMarks}`}
        />
        <Stat variant="leaf" label="Correct" value={computed.correct} />
        <Stat variant="stamp" label="Incorrect" value={computed.incorrect} />
        <Stat label="Unattempted" value={computed.unattempted} />
      </div>

      {!computed.isRevision && !statsLoading && reviewStats && (
        <>
          <div className="grid">
            <div className="card">
              <div className="card__head"><h2 className="card__title">🎯 Subject Analysis</h2></div>
              <div className="chart-wrap"><canvas ref={spiderRef}></canvas></div>
            </div>
            <div className="card">
              <div className="card__head"><h2 className="card__title">📊 Comparison</h2></div>
              <div className="chart-wrap"><canvas ref={comparisonRef}></canvas></div>
            </div>
            <div className="card">
              <div className="card__head"><h2 className="card__title">🧠 Confidence vs Accuracy</h2></div>
              <div className="chart-wrap"><canvas ref={confidenceRef}></canvas></div>
            </div>
          </div>

          <div className="stats-grid" style={{ marginTop: 28, marginBottom: 28 }}>
            <Stat
              variant="stamp"
              label="Silly Mistakes"
              value={computed.sillyMistakes}
              sub="Easy questions missed"
            />
            <Stat
              variant="leaf"
              label="Hard Successes"
              value={computed.hardSuccess}
              sub="Hard questions correct"
            />
          </div>
        </>
      )}

      {computed.isRevision && (
        <div className="card" style={{ marginBottom: 28, background: "var(--pen-soft)" }}>
          <p style={{ margin: 0, fontWeight: 500, color: "var(--pen)" }}>
            📈 <strong>Revision Test:</strong> Advanced charts are hidden for revision tests.
          </p>
        </div>
      )}

      <div className="review-grid">
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Questions Review</h2>
          </div>

          <div style={{ marginBottom: 16 }}>
            <span className="eyebrow" style={{ display: "block", marginBottom: 8 }}>Filter by Status</span>
            <div className="tabs">
              {[
                { id: "all", label: "All" },
                { id: "correct", label: "Correct" },
                { id: "incorrect", label: "Incorrect" },
                { id: "unattempted", label: "Unattempted" },
              ].map((t) => (
                <button
                  key={t.id}
                  className={`tabs__tab ${statusFilter === t.id ? "tabs__tab--active" : ""}`}
                  onClick={() => setStatusFilter(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <span className="eyebrow" style={{ display: "block", marginBottom: 8 }}>Filter by Subject</span>
            <select
              className="form-select"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              style={{
                border: "1.5px solid var(--line)",
                borderRadius: "var(--radius-sm)",
                background: "var(--card)",
                padding: "8px 12px",
                font: "inherit",
                width: "100%",
                maxWidth: 240,
                color: "var(--ink)"
              }}
            >
              <option value="all">All Subjects</option>
              {uniqueSubjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            {quizData.map((q, idx) => {
              const uAns = userAnswers[idx];
              const cIdx = getCorrectIndex(q);
              
              let statusStr = "unattempted";
              if (uAns) {
                statusStr = uAns.answer === cIdx ? "correct" : "incorrect";
              }

              if (statusFilter !== "all" && statusStr !== statusFilter) return null;

              if (subjectFilter !== "all") {
                const hasTag = q.tags && q.tags.includes(`subject:${subjectFilter}`);
                if (!hasTag) return null;
              }

              let diffHtml = null;
              if (!computed.isRevision && reviewStats) {
                const commCorrect = reviewStats.correctCounts ? reviewStats.correctCounts[idx] : 0;
                const commTotal = reviewStats.totalAttempts || 0;
                const dInfo = DifficultyHelper.calculate(commCorrect, commTotal);
                
                let bClass = "badge--pen";
                if (dInfo.label === "Easy") bClass = "badge--leaf";
                if (dInfo.label === "Hard") bClass = "badge--stamp";

                diffHtml = (
                  <span className={`badge ${bClass}`}>
                    {dInfo.label} (Comm: {dInfo.percent}%)
                  </span>
                );
              }

              const timeSpent = questionTimeSpent && questionTimeSpent[idx] !== undefined
                ? questionTimeSpent[idx]
                : null;
              const timeStr = timeSpent !== null ? `${Math.floor(timeSpent / 60)}m ${timeSpent % 60}s` : "N/A";

              let statusBadge = null;
              if (statusStr === "correct") statusBadge = <span className="badge badge--leaf">✓ Correct</span>;
              else if (statusStr === "incorrect") statusBadge = <span className="badge badge--stamp">✗ Incorrect</span>;
              else statusBadge = <span className="badge">⚪ Unattempted</span>;

              return (
                <div key={idx} className="review-q">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" }}>
                    <span className="eyebrow" style={{ color: "var(--ink)", fontWeight: 700, fontSize: 13 }}>Q{idx + 1}</span>
                    {statusBadge}
                    {diffHtml}
                    {uAns && uAns.surety !== undefined && (
                      <span className="badge badge--marker">Conf: {uAns.surety}%</span>
                    )}
                    <span className="badge">⏱ {timeStr}</span>
                  </div>

                  <div style={{ fontSize: 16, marginBottom: 16, lineHeight: 1.6 }}>
                    <span dangerouslySetInnerHTML={{ __html: TextFormatter.formatQuestionText(q.text) }} />
                  </div>

                  <div className="grid" style={{ marginBottom: 16 }}>
                    {q.options.map((opt, oIdx) => {
                      const isCorrect = oIdx === cIdx;
                      const isSelected = uAns && uAns.answer === oIdx;
                      
                      let optCls = "option";
                      let omrCls = "omr";
                      
                      if (isCorrect) {
                        optCls += " option--correct";
                        omrCls += " omr--correct";
                      } else if (isSelected && !isCorrect) {
                        optCls += " option--wrong";
                        omrCls += " omr--wrong";
                      }

                      return (
                        <div key={oIdx} className={optCls} style={{ cursor: "default", pointerEvents: "none" }}>
                          <div className={omrCls}>{["A", "B", "C", "D"][oIdx]}</div>
                          <div className="option__text" dangerouslySetInnerHTML={{ __html: opt }} />
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="explanation">
                      <strong style={{ display: "block", marginBottom: 4 }}>💡 Explanation:</strong>
                      <span dangerouslySetInnerHTML={{ __html: q.explanation }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="sidebar">
          <div className="card" style={{ padding: "16px 14px" }}>
            <div className="card__head">
              <h2 className="card__title">🏆 Leaderboard</h2>
            </div>
            
            {leaderboard === null ? (
              <div className="empty">
                <div className="spinner"></div>
              </div>
            ) : leaderboard.length === 0 ? (
              <p style={{ color: "var(--ink-soft)", fontSize: 13, margin: 0 }}>
                No records yet. Be the first!
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>User</th>
                      <th style={{ textAlign: "right" }}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, idx) => {
                      const isMe = currentUser && currentUser.email === entry.userEmail;
                      return (
                        <tr key={idx} className={isMe ? "highlight" : ""}>
                          <td style={{ fontWeight: 700 }}>
                            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                          </td>
                          <td>
                            {entry.userEmail ? entry.userEmail.split("@")[0] : "guest"}
                            {isMe && " (You)"}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>
                            {entry.scorePercent}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
