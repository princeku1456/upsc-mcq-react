import React, { memo } from "react";

const LeaderboardTable = memo(function LeaderboardTable({ entries, currentUserEmail }) {
  if (!entries) {
    return (
      <div className="empty">
        <div className="spinner"></div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p style={{ color: "var(--ink-soft)", fontSize: 13, margin: 0 }}>
        No records yet. Be the first!
      </p>
    );
  }

  return (
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
          {entries.map((entry, idx) => {
            const isMe = currentUserEmail && currentUserEmail === entry.userEmail;
            return (
              <tr key={entry.userEmail || idx} className={isMe ? "highlight" : ""}>
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
  );
});

export default LeaderboardTable;
