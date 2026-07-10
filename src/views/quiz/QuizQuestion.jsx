import React, { memo } from "react";
import OptionGroup from "../../components/ui/OptionGroup";
import ConfidenceBar from "../../components/ui/ConfidenceBar";
import { TextFormatter } from "../../lib/helpers";

const QuizQuestion = memo(function QuizQuestion({
  question,
  currentQuestionIndex,
  totalQuestions,
  userAnswer,
  isMarked,
  isSubmitted,
  isTimerPaused,
  correctIndex,
  onSelectAnswer,
  onSelectSurety,
  onClearSelection,
  onToggleMarkForReview,
  onNavigate,
}) {
  const selectedIndex = userAnswer?.answer;
  const currentSurety = userAnswer?.surety;

  return (
    <div className="card" style={{ padding: "24px 28px" }}>
      <div className="card__head">
        <h2 className="card__title">Question {currentQuestionIndex + 1}</h2>
        <button
          className={`btn btn--sm ${isMarked ? "btn--subtle" : "btn--ghost"}`}
          onClick={onToggleMarkForReview}
        >
          {isMarked ? "★ Unmark" : "☆ Mark for Review"}
        </button>
      </div>

      <div
        style={isTimerPaused ? { filter: "blur(8px)", pointerEvents: "none" } : { filter: "none" }}
      >
        <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 24, lineHeight: 1.6 }}>
          <span dangerouslySetInnerHTML={{ __html: TextFormatter.formatQuestionText(question.text || question.question) }} />
        </div>

        <OptionGroup
          options={question.options}
          correctIndex={correctIndex}
          selectedIndex={selectedIndex}
          disabled={isSubmitted || isTimerPaused}
          submitted={isSubmitted}
          onSelect={onSelectAnswer}
        />

        <div style={{ marginTop: 24 }}>
          <ConfidenceBar
            value={currentSurety}
            onChange={onSelectSurety}
            disabled={isSubmitted || isTimerPaused}
          />
        </div>

        {isSubmitted && question.explanation && (
          <div className="explanation" style={{ marginTop: 24 }}>
            <strong style={{ display: "block", marginBottom: 4 }}>💡 Explanation:</strong>
            <span dangerouslySetInnerHTML={{ __html: question.explanation }} />
          </div>
        )}
      </div>

      <div className="runner__nav">
        <button className="btn btn--ghost" disabled={currentQuestionIndex === 0} onClick={() => onNavigate(-1)}>
          Previous
        </button>
        <button className="btn btn--ghost" disabled={isSubmitted} onClick={onClearSelection}>
          Clear
        </button>
        <button className="btn btn--ghost" disabled={currentQuestionIndex === totalQuestions - 1} onClick={() => onNavigate(1)}>
          Next
        </button>
      </div>
    </div>
  );
});

export default QuizQuestion;
