import React from "react";
import TimerDisplay from "../../components/ui/TimerDisplay";
import QuestionPalette from "../../components/ui/QuestionPalette";

export default function QuizSidebar({
  timerDisplay,
  timerLow,
  isTimerPaused,
  quizData,
  currentQuestionIndex,
  userAnswers,
  markedForReview,
  isSubmitted,
  onToggleTimer,
  onSelectQuestion,
  onSubmit,
}) {
  return (
    <div className="sidebar">
      <div className="card" style={{ padding: "16px 14px", marginBottom: 14 }}>
        <TimerDisplay
          text={timerDisplay.text}
          low={timerLow}
          onToggle={onToggleTimer}
          isPaused={isTimerPaused}
          showControls={!isSubmitted}
        />

        <div className="card__head">
          <span className="eyebrow">Question Palette</span>
        </div>

        <QuestionPalette
          quizData={quizData}
          currentIndex={currentQuestionIndex}
          userAnswers={userAnswers}
          markedForReview={markedForReview}
          submitted={isSubmitted}
          onSelect={onSelectQuestion}
        />

        {!isSubmitted && (
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="btn btn--success btn--block" onClick={() => onSubmit(false)}>
              Submit Test
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
