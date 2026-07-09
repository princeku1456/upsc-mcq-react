import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../../store";
import { useGlobalStats } from "../../hooks/useDataManager";
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

  const { stats: reviewStats, loading: statsLoading, fetchStats } = useGlobalStats(chapterId);
  const [leaderboard, setLeaderboard] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  useEffect(() => {
    if (!chapterId.startsWith("revision_")) {
      fetchStats(chapterId);
    } else {
      setLeaderboard([]);
    }
  }, [chapterId, fetchStats]);

  useEffect(() => {
    if (reviewStats && reviewStats.leaderboard) setLeaderboard(reviewStats.leaderboard);
    else if (!statsLoading) setLeaderboard([]);
  }, [reviewStats, statsLoading]);

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
      <div className="review-hero">
        <div>
          <h1>{chapterName}</h1>
          <p>Performance review &amp; analytics</p>
        </div>
        <button className="btn btn--ghost" onClick={onExit} style={{ padding: "8px 16px" }}>
          ← Back
        </button>
      </div>

      <ReviewStatsBar computed={computed} />

      {!computed.isRevision && !statsLoading && reviewStats && (
        <ReviewCharts computed={computed} reviewStats={reviewStats} quizData={quizData} />
      )}

      {computed.isRevision && (
        <div className="card" style={{ marginBottom: 28, background: "var(--pen-soft)", border: "1px solid var(--pen)" }}>
          <p style={{ margin: 0, fontWeight: 500, color: "var(--pen)", fontSize: 14 }}>
            📈 <strong>Revision Test</strong> — analytics charts are hidden for revision tests. Only question review is available.
          </p>
        </div>
      )}

      <div className="review-grid">
        <div>
          <div className="card review-filters">
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span className="eyebrow" style={{ marginRight: 4 }}>Filter</span>
                <Tabs options={STATUS_FILTERS} active={statusFilter} onChange={setStatusFilter} />
              </div>
              {uniqueSubjects.length > 0 && (
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  style={{
                    border: "1.5px solid var(--line)", borderRadius: "var(--radius-sm)",
                    background: "var(--card)", padding: "7px 12px", font: "inherit", fontSize: 13,
                    color: "var(--ink)", minWidth: 160,
                  }}
                >
                  <option value="all">All Subjects</option>
                  {uniqueSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
          </div>

          <ReviewQuestionList
            quizData={quizData} userAnswers={userAnswers} reviewStats={reviewStats}
            questionTimeSpent={questionTimeSpent} isRevision={computed.isRevision}
            statusFilter={statusFilter} subjectFilter={subjectFilter}
          />
        </div>

        <ReviewSidebar leaderboard={leaderboard} statsLoading={statsLoading} />
      </div>
    </div>
  );
}
