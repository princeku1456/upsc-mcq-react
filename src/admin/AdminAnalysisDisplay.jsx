import React from "react";

export function Palette({ accuracies }) {
  return (
    <div id="admin-palette-grid" className="palette-grid">
      {accuracies.map((acc, i) => {
        let heatClass = "heat-high";
        if (acc < 40) heatClass = "heat-low";
        else if (acc <= 70) heatClass = "heat-mid";
        return (
          <div
            key={i}
            className={`palette-item ${heatClass}`}
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
      <div className="table-responsive">
        <table className="table table-hover mb-0">
          <thead className="table-light">
            <tr><th>Rank</th><th>User</th><th>Score</th><th>Accuracy</th></tr>
          </thead>
          <tbody>
            {leaderboardArr.length === 0 ? (
              <tr><td colSpan="4" className="text-center">No records.</td></tr>
            ) : (
              leaderboardArr.map((entry, i) => (
                <tr key={i}>
                  <td className="fw-bold">#{i + 1}</td>
                  <td>{entry.userEmail.split("@")[0]}</td>
                  <td>{entry.score.toFixed(1)}</td>
                  <td><span className={`badge ${entry.scorePercent >= 80 ? "bg-success" : "bg-secondary"}`}>{entry.scorePercent}%</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="text-center text-muted py-5">
      <div className="display-1 opacity-25 mb-3"><i className="bi bi-bar-chart-steps"></i></div>
      <h4>Select a test to begin the Discussion Session.</h4>
    </div>
  );
}
