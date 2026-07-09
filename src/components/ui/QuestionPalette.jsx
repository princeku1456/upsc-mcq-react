import React from "react";
import { getCorrectIndex } from "../../lib/helpers";

export default function QuestionPalette({ quizData, currentIndex, userAnswers, markedForReview, submitted, onSelect }) {
  return (
    <div className="palette">
      {quizData.map((_, i) => {
        let cls = "palette__cell";
        if (i === currentIndex) cls += " palette__cell--current";

        const uAns = userAnswers[i];
        const marked = markedForReview[i];

        if (submitted) {
          const cIdx = getCorrectIndex(quizData[i]);
          if (!uAns) cls += " palette__cell--unanswered";
          else if (uAns.answer === cIdx) cls += " palette__cell--correct";
          else cls += " palette__cell--wrong";
        } else {
          if (uAns) cls += " palette__cell--answered";
          else if (marked) cls += " palette__cell--marked";
        }

        return (
          <button key={i} className={cls} onClick={() => onSelect(i)}>
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
