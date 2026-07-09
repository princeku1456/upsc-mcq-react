import React from "react";
import Stat from "../../components/ui/Stat";

export default function ReviewStatsBar({ computed }) {
  const pct = computed.totalMarks > 0
    ? ((computed.finalScore / computed.totalMarks) * 100).toFixed(1)
    : "0";

  return (
    <div className="review-stats">
      <Stat variant="score" label="Score" value={pct + "%"} sub={`${computed.finalScore.toFixed(1)} / ${computed.totalMarks}`} />
      <Stat variant="leaf" label="Correct" value={computed.correct} />
      <Stat variant="stamp" label="Incorrect" value={computed.incorrect} />
      <Stat label="Unattempted" value={computed.unattempted} />
      <Stat variant="stamp" label="Silly Mistakes" value={computed.sillyMistakes} sub="Easy qs missed" />
      <Stat variant="leaf" label="Hard Successes" value={computed.hardSuccess} sub="Hard qs correct" />
    </div>
  );
}
