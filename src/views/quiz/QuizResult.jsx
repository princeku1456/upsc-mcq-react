import React from "react";
import Stat from "../../components/ui/Stat";

export default function QuizResult({ result, statsLine, onReview }) {
  return (
    <div style={{ marginTop: 30, borderTop: "1px dashed var(--line)", paddingTop: 30 }}>
      <div className="score-strip">
        <div className="score-strip__big">Score: {result.finalScore}</div>
        <div>
          <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>Total Marks</div>
          <div style={{ fontWeight: 600 }}>{result.totalMarks}</div>
        </div>
        <div>
          <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>Accuracy</div>
          <div style={{ fontWeight: 600 }}>{result.percentage}%</div>
        </div>
      </div>

      <div className="stats-grid">
        <Stat variant="leaf" label="Correct" value={result.correct} />
        <Stat variant="stamp" label="Incorrect" value={result.incorrect} />
        <Stat label="Unattempted" value={result.unattempted} />
      </div>

      <div style={{ marginTop: 16, color: "var(--ink-soft)", fontSize: 13 }}>
        {statsLine ? (
          <span dangerouslySetInnerHTML={{ __html: statsLine }} />
        ) : (
          "Calculating class standing..."
        )}
      </div>

      <button className="btn btn--primary btn--block" style={{ marginTop: 20 }} onClick={onReview}>
        👁 Review Performance Details
      </button>
    </div>
  );
}
