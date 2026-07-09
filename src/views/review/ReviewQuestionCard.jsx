import React from "react";
import { getCorrectIndex, DifficultyHelper, TextFormatter } from "../../lib/helpers";

export default function ReviewQuestionCard({ question, idx, userAnswer, reviewStats, questionTimeSpent, isRevision, statusFilter, subjectFilter }) {
  const cIdx = getCorrectIndex(question);
  const uAns = userAnswer;

  let statusStr = "unattempted";
  if (uAns) statusStr = uAns.answer === cIdx ? "correct" : "incorrect";

  if (statusFilter !== "all" && statusStr !== statusFilter) return null;
  if (subjectFilter !== "all") {
    const hasTag = question.tags && question.tags.includes(`subject:${subjectFilter}`);
    if (!hasTag) return null;
  }

  let diffHtml = null;
  if (!isRevision && reviewStats) {
    const commCorrect = reviewStats.correctCounts ? reviewStats.correctCounts[idx] : 0;
    const commTotal = reviewStats.totalAttempts || 0;
    const dInfo = DifficultyHelper.calculate(commCorrect, commTotal);
    let bClass = "badge--pen";
    if (dInfo.label === "Easy") bClass = "badge--leaf";
    if (dInfo.label === "Hard") bClass = "badge--stamp";
    diffHtml = <span className={`badge ${bClass}`}>{dInfo.label} (Comm: {dInfo.percent}%)</span>;
  }

  const timeSpent = questionTimeSpent && questionTimeSpent[idx] !== undefined
    ? questionTimeSpent[idx] : null;
  const timeStr = timeSpent !== null ? `${Math.floor(timeSpent / 60)}m ${timeSpent % 60}s` : "N/A";

  let statusBadge;
  if (statusStr === "correct") statusBadge = <span className="badge badge--leaf">✓ Correct</span>;
  else if (statusStr === "incorrect") statusBadge = <span className="badge badge--stamp">✗ Incorrect</span>;
  else statusBadge = <span className="badge">⚪ Unattempted</span>;

  const labelMap = ["A", "B", "C", "D"];

  return (
    <div className="review-q">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <span className="eyebrow" style={{ color: "var(--ink)", fontWeight: 700, fontSize: 13 }}>Q{idx + 1}</span>
        {statusBadge}
        {diffHtml}
        {uAns && uAns.surety !== undefined && <span className="badge badge--marker">Conf: {uAns.surety}%</span>}
        <span className="badge">⏱ {timeStr}</span>
      </div>

      <div style={{ fontSize: 16, marginBottom: 16, lineHeight: 1.6 }}>
        <span dangerouslySetInnerHTML={{ __html: TextFormatter.formatQuestionText(question.text) }} />
      </div>

      <div className="grid" style={{ marginBottom: 16 }}>
        {question.options.map((opt, oIdx) => {
          const isCorrect = oIdx === cIdx;
          const isSelected = uAns && uAns.answer === oIdx;
          let optCls = "option";
          let omrCls = "omr";
          if (isCorrect) { optCls += " option--correct"; omrCls += " omr--correct"; }
          else if (isSelected && !isCorrect) { optCls += " option--wrong"; omrCls += " omr--wrong"; }
          return (
            <div key={oIdx} className={optCls} style={{ cursor: "default", pointerEvents: "none" }}>
              <div className={omrCls}>{labelMap[oIdx]}</div>
              <div className="option__text" dangerouslySetInnerHTML={{ __html: opt }} />
            </div>
          );
        })}
      </div>

      {question.explanation && (
        <div className="explanation">
          <strong style={{ display: "block", marginBottom: 4 }}>💡 Explanation:</strong>
          <span dangerouslySetInnerHTML={{ __html: question.explanation }} />
        </div>
      )}
    </div>
  );
}
