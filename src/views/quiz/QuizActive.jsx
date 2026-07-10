import React, { memo } from "react";
import QuizQuestion from "./QuizQuestion";
import QuizSidebar from "./QuizSidebar";
import QuizResult from "./QuizResult";
import { getCorrectIndex } from "../../lib/helpers";

const QuizActive = memo(function QuizActive({
  quizData,
  currentQuestionIndex,
  userAnswers,
  markedForReview,
  isSubmitted,
  isTimerPaused,
  timerDisplay,
  timerLow,
  result,
  statsLine,
  onSelectAnswer,
  onSelectSurety,
  onClearSelection,
  onToggleMarkForReview,
  onNavigateQuestions,
  onToggleTimer,
  onSelectQuestion,
  onSubmit,
  onReview,
}) {
  const question = quizData[currentQuestionIndex];
  const uAnsCurrent = userAnswers[currentQuestionIndex];
  const isMarked = !!markedForReview[currentQuestionIndex];
  const correctIndex = getCorrectIndex(question);

  return (
    <div className="runner">
      <div className="runner__grid">
        <div>
          <QuizQuestion
            question={question}
            currentQuestionIndex={currentQuestionIndex}
            totalQuestions={quizData.length}
            userAnswer={uAnsCurrent}
            isMarked={isMarked}
            isSubmitted={isSubmitted}
            isTimerPaused={isTimerPaused}
            correctIndex={correctIndex}
            onSelectAnswer={onSelectAnswer}
            onSelectSurety={onSelectSurety}
            onClearSelection={onClearSelection}
            onToggleMarkForReview={onToggleMarkForReview}
            onNavigate={onNavigateQuestions}
          />

          {result && (
            <QuizResult result={result} statsLine={statsLine} onReview={onReview} />
          )}
        </div>

        <QuizSidebar
          timerDisplay={timerDisplay}
          timerLow={timerLow}
          isTimerPaused={isTimerPaused}
          quizData={quizData}
          currentQuestionIndex={currentQuestionIndex}
          userAnswers={userAnswers}
          markedForReview={markedForReview}
          isSubmitted={isSubmitted}
          onToggleTimer={onToggleTimer}
          onSelectQuestion={onSelectQuestion}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
});

export default QuizActive;
