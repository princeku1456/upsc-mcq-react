import React from "react";
import LeaderboardTable from "../components/ui/LeaderboardTable";
import EmptyState from "../components/ui/EmptyState";

export function Palette({ accuracies }) {
  return (
    <div id="admin-palette-grid" className="admin-palette-grid">
      {accuracies.map((acc, i) => {
        let heatClass = "admin-heat-high";
        if (acc < 40) heatClass = "admin-heat-low";
        else if (acc <= 70) heatClass = "admin-heat-mid";
        return (
          <div
            key={i}
            className={`admin-palette-item ${heatClass}`}
            title={`Accuracy: ${acc}%`}
            role="button"
            tabIndex={0}
            aria-label={`Question ${i + 1}: ${acc}% Accuracy`}
            onClick={() => {
              const el = document.getElementById(`q-card-${i}`);
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                const el = document.getElementById(`q-card-${i}`);
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }
            }}
          >
            {i + 1}
          </div>
        );
      })}
    </div>
  );
}

export function Leaderboard({ leaderboardArr, stats }) {
  return (
    <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-5">
      <div className="card-header bg-white border-bottom p-4">
        <h5 className="fw-bold text-primary m-0">🏆 Leaderboard</h5>
        <small className="text-muted">
          Total Attempts: {stats.totalAttempts} | Global Avg: {stats.average ? stats.average.toFixed(1) : 0}%
        </small>
      </div>
      <LeaderboardTable entries={leaderboardArr} currentUserEmail={null} />
    </div>
  );
}

export { EmptyState };
