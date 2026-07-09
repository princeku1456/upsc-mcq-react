import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../../store";
import { DataManager } from "../../lib/dataManager";
import { useReviewStats } from "../../hooks/useReviewStats";
import Tabs from "../../components/ui/Tabs";
import { STATUS_FILTERS } from "../../config/constants";
import ReviewStatsBar from "./ReviewStatsBar";
import ReviewCharts from "./ReviewCharts";
import ReviewQuestionList from "./ReviewQuestionList";
import ReviewSidebar from "./ReviewSidebar";

export default function ReviewMode({
  quizData, userAnswers, questionTimeSpent, resultData,
  chapterId, chapterName, onExit,
}) {
  const { theme } = useApp();

  const [reviewStats, setReviewStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

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
    return () => { cancelled = true; };
  }, [chapterId]);

  const computed = useReviewStats(quizData, userAnswers, reviewStats, chapterId);

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

      <ReviewStatsBar computed={computed} />

      {!computed.isRevision && !statsLoading && reviewStats && (
        <ReviewCharts computed={computed} reviewStats={reviewStats} quizData={quizData} />
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
            <Tabs options={STATUS_FILTERS} active={statusFilter} onChange={setStatusFilter} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <span className="eyebrow" style={{ display: "block", marginBottom: 8 }}>Filter by Subject</span>
            <select
              className="form-select"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              style={{
                border: "1.5px solid var(--line)", borderRadius: "var(--radius-sm)",
                background: "var(--card)", padding: "8px 12px", font: "inherit",
                width: "100%", maxWidth: 240, color: "var(--ink)",
              }}
            >
              <option value="all">All Subjects</option>
              {uniqueSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <ReviewQuestionList
            quizData={quizData} userAnswers={userAnswers} reviewStats={reviewStats}
            questionTimeSpent={questionTimeSpent} isRevision={computed.isRevision}
            statusFilter={statusFilter} subjectFilter={subjectFilter}
          />
        </div>

        <ReviewSidebar leaderboard={leaderboard} />
      </div>
    </div>
  );
}
