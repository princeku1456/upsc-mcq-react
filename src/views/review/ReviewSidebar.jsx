import React from "react";
import LeaderboardTable from "../../components/ui/LeaderboardTable";
import { useApp } from "../../store";

export default function ReviewSidebar({ leaderboard, statsLoading }) {
  const { currentUser } = useApp();

  return (
    <div className="sidebar">
      <div className="card" style={{ padding: "16px 14px" }}>
        <div className="card__head">
          <h2 className="card__title">🏆 Leaderboard</h2>
        </div>
        <LeaderboardTable
          entries={leaderboard}
          currentUserEmail={currentUser?.email}
        />
      </div>
    </div>
  );
}
