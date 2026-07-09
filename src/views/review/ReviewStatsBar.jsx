import React from "react";
import Stat from "../../components/ui/Stat";

export default function ReviewStatsBar({ computed }) {
  return (
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
  );
}
