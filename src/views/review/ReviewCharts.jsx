import React from "react";
import { Chart } from "../../lib/chartHelper";
import { SUBJECT_KEYS } from "../../config/constants";
import { useApp } from "../../store";
import { useChart } from "../../hooks/useChart";

export default function ReviewCharts({ computed, reviewStats, quizData }) {
  const { theme } = useApp();

  const spiderRef = useChart((canvas) => {
    if (!reviewStats) return null;

    const isDark = theme === "dark";
    const tColor = isDark ? "#e2e8f0" : "#334155";
    const gColor = isDark ? "#334155" : "#e2e8f0";

    const radarLabels = [];
    const radarUserData = [];
    const radarCommData = [];
    const stats = reviewStats;

    SUBJECT_KEYS.forEach((subj) => {
      if (computed.subjectStats[subj] && computed.subjectStats[subj].total > 0) {
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

    if (radarLabels.length === 0) return null;

    return new Chart(canvas, {
      type: "radar",
      data: {
        labels: radarLabels,
        datasets: [
          {
            label: "Your Accuracy (%)", data: radarUserData,
            backgroundColor: "rgba(59, 130, 246, 0.2)", borderColor: "#3b82f6",
            pointBackgroundColor: "#3b82f6", borderWidth: 2,
          },
          {
            label: "Community Accuracy (%)", data: radarCommData,
            backgroundColor: "rgba(107, 114, 128, 0.2)", borderColor: "#6b7280",
            pointBackgroundColor: "#6b7280", borderWidth: 2, borderDash: [5, 5],
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { r: { angleLines: { color: gColor }, grid: { color: gColor }, pointLabels: { color: tColor, font: { size: 11 } }, ticks: { display: false, min: 0, max: 100 } } },
        plugins: { legend: { position: "bottom", labels: { color: tColor, padding: 16, font: { size: 12 } } } },
      },
    });
  }, [reviewStats, computed, quizData, theme]);

  const comparisonRef = useChart((canvas) => {
    if (!reviewStats) return null;

    const isDark = theme === "dark";
    const tColor = isDark ? "#e2e8f0" : "#334155";
    const gColor = isDark ? "#334155" : "#e2e8f0";
    const stats = reviewStats;

    const userP = (computed.finalScore / computed.totalMarks) * 100;
    const commAvgP = (stats.totalScore || 0) / (stats.totalAttempts || 1);
    const commHighP = stats.highestScore || 0;

    return new Chart(canvas, {
      type: "bar",
      data: {
        labels: ["You", "Comm. Avg", "Highest"],
        datasets: [{ label: "Score (%)", data: [userP, commAvgP, commHighP], backgroundColor: ["#3b82f6", "#94a3b8", "#f59e0b"], borderRadius: 6, barPercentage: 0.6 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { x: { grid: { display: false }, ticks: { color: tColor, font: { size: 12 } } }, y: { min: 0, max: 100, grid: { color: gColor }, ticks: { color: tColor } } },
        plugins: { legend: { display: false } },
      },
    });
  }, [reviewStats, computed, theme]);

  const confidenceRef = useChart((canvas) => {
    if (!reviewStats) return null;

    const isDark = theme === "dark";
    const tColor = isDark ? "#e2e8f0" : "#334155";
    const gColor = isDark ? "#334155" : "#e2e8f0";

    const { confStats } = computed;
    const confLabels = ["Sure", "Likely", "Maybe", "Guess"];
    const confAccData = [];
    const confCounts = [confStats[100].total, confStats[75].total, confStats[50].total, confStats[0].total];
    [100, 75, 50, 0].forEach((level) => {
      const { total, correct } = confStats[level];
      confAccData.push(total > 0 ? (correct / total) * 100 : 0);
    });

    return new Chart(canvas, {
      type: "bar",
      data: {
        labels: confLabels,
        datasets: [
          { label: "Accuracy (%)", data: confAccData, backgroundColor: "#10b981", borderRadius: 6, barPercentage: 0.7, yAxisID: "y" },
          { label: "Count", data: confCounts, type: "line", borderColor: "#f59e0b", backgroundColor: "#f59e0b", borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: "#f59e0b", tension: 0.2, yAxisID: "y1" },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { grid: { color: gColor }, ticks: { color: tColor, font: { size: 12 } } },
          y: { type: "linear", position: "left", min: 0, max: 100, grid: { color: gColor }, ticks: { color: tColor }, title: { display: true, text: "Accuracy %", color: tColor } },
          y1: { type: "linear", position: "right", min: 0, grid: { drawOnChartArea: false }, ticks: { color: tColor, precision: 0 }, title: { display: true, text: "Questions", color: tColor } },
        },
        plugins: { legend: { position: "bottom", labels: { color: tColor, padding: 16, font: { size: 12 } } } },
      },
    });
  }, [reviewStats, computed, theme]);

  if (computed.isRevision) return null;

  return (
    <div className="review-charts-grid">
      <div className="card">
        <div className="card__head">
          <h2 className="card__title">📊 Score Comparison</h2>
        </div>
        <div className="chart-wrap" style={{ height: 220 }}>
          <canvas ref={comparisonRef}></canvas>
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <h2 className="card__title">🎯 Subject Analysis</h2>
        </div>
        <div className="chart-wrap" style={{ height: 280 }}>
          <canvas ref={spiderRef}></canvas>
        </div>
      </div>

      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <div className="card__head">
          <h2 className="card__title">🧠 Confidence vs Accuracy</h2>
        </div>
        <div className="chart-wrap" style={{ height: 260 }}>
          <canvas ref={confidenceRef}></canvas>
        </div>
      </div>
    </div>
  );
}
