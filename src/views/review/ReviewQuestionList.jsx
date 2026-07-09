import React from "react";
import ReviewQuestionCard from "./ReviewQuestionCard";

export default function ReviewQuestionList({
  quizData, userAnswers, reviewStats, questionTimeSpent,
  isRevision, statusFilter, subjectFilter,
}) {
  return (
    <div>
      {quizData.map((q, idx) => (
        <ReviewQuestionCard
          key={idx}
          question={q}
          idx={idx}
          userAnswer={userAnswers[idx]}
          reviewStats={reviewStats}
          questionTimeSpent={questionTimeSpent}
          isRevision={isRevision}
          statusFilter={statusFilter}
          subjectFilter={subjectFilter}
        />
      ))}
    </div>
  );
}
