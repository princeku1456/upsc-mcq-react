import { useState, useRef, useCallback } from "react";
import { QuizTimer } from "../lib/timer";
import { QUIZ_TIMER_PER_QUESTION_SECONDS } from "../config/constants";

export function useQuizTimer(questionCount) {
  const [timerDisplay, setTimerDisplay] = useState({ text: "00:00", low: false });
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);
  const onCompleteRef = useRef(null);

  const start = useCallback(
    (resumedTimeLeft, onComplete) => {
      onCompleteRef.current = onComplete;
      const limit = resumedTimeLeft !== null
        ? resumedTimeLeft
        : questionCount * QUIZ_TIMER_PER_QUESTION_SECONDS;

      timerRef.current = new QuizTimer(
        (text, low) => setTimerDisplay({ text, low }),
        null,
        () => {
          if (onCompleteRef.current) onCompleteRef.current();
        }
      );
      timerRef.current.start(limit);
      setIsPaused(false);
    },
    [questionCount]
  );

  const toggle = useCallback(() => {
    if (!timerRef.current) return;
    if (isPaused) {
      timerRef.current.resume();
      setIsPaused(false);
    } else {
      timerRef.current.pause();
      setIsPaused(true);
    }
  }, [isPaused]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      timerRef.current.stop();
      timerRef.current = null;
    }
  }, []);

  const getTimeLeft = useCallback(() => {
    return timerRef.current ? timerRef.current.secondsRemaining : null;
  }, []);

  return { timerDisplay, isPaused, start, toggle, stop, getTimeLeft };
}
