import React from "react";
import Stat from "../../components/ui/Stat";
import { useDashboardStats } from "../../hooks/useDashboardStats";

export default function DashboardStats({ userHistory, conceptGap }) {
  const stats = useDashboardStats(userHistory);

  return (
    <>
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <Stat variant="pen" label="Tests Taken" value={stats.totalTests} />
        <Stat variant="marker" label="Avg. Score" value={`${stats.avgScore}%`} />
        <Stat variant="leaf" label="Precision" value={`${stats.precisionRate}%`} sub="Net Accuracy" />
        <Stat variant="stamp" label="Neg. Drain" value={`${stats.negativeDrain}%`} sub="Marks Lost" />
        <div className={`stat ${conceptGap.cls}`}>
          <span className="eyebrow">Concept Gap</span>
          <span className="stat__value" id="stat-concept-gap">{conceptGap.text}</span>
          <span className="stat__sub">Easy Qs Missed</span>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <Stat label="Total Qs" value={stats.totalQs} />
        <Stat variant="pen" label="Attempted" value={stats.totalAttempted} />
        <Stat label="Unattempted" value={Math.max(0, stats.totalUnattempted)} />
        <Stat variant="leaf" label="Correct" value={stats.totalCorrect} />
        <Stat variant="stamp" label="Incorrect" value={stats.totalIncorrect} />
      </div>
    </>
  );
}
