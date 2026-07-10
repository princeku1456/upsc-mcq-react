import React, { useMemo } from "react";
import ReviewQuestionCard from "./ReviewQuestionCard";
import { getCorrectIndex } from "../../lib/helpers";

export default function ReviewQuestionList({
  quizData, userAnswers, reviewStats, questionTimeSpent,
  isRevision, statusFilter, subjectFilter,
}) {
  const filtered = useMemo(() => {
    return quizData.reduce((acc, q, idx) => {
      const uAns = userAnswers[idx];
      const cIdx = getCorrectIndex(q);
      let statusStr = "unattempted";
      if (uAns) statusStr = uAns.answer === cIdx ? "correct" : "incorrect";

      if (statusFilter !== "all" && statusStr !== statusFilter) return acc;
      if (subjectFilter !== "all") {
        const hasTag = q.tags && q.tags.some((t) => t.startsWith("subject:") && t.includes(`subject:${subjectFilter}`));
        if (!hasTag) return acc;
      }

      acc.push({ q, idx, uAns });
      return acc;
    }, []);
  }, [quizData, userAnswers, statusFilter, subjectFilter]);

  return (
    <div>
      {filtered.map(({ q, idx, uAns }) => (
        <ReviewQuestionCard
          key={idx}
          question={q}
          idx={idx}
          userAnswer={uAns}
          reviewStats={reviewStats}
          questionTimeSpent={questionTimeSpent}
          isRevision={isRevision}
        />
      ))}
    </div>
  );
}
