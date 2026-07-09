import { useRef, useCallback } from "react";

export function useQuizNavigation(totalQuestions, isPaused) {
  const currentQuestionIndexRef = useRef(0);
  const questionStartTimeRef = useRef(Date.now());
  const questionTimeSpentRef = useRef({});

  const getCurrentIndex = useCallback(() => currentQuestionIndexRef.current, []);

  const updateTimeSpent = useCallback(() => {
    if (isPaused) return;
    const now = Date.now();
    const idx = currentQuestionIndexRef.current;
    const spent = Math.floor((now - questionStartTimeRef.current) / 1000);
    questionTimeSpentRef.current[idx] =
      (questionTimeSpentRef.current[idx] || 0) + spent;
    questionStartTimeRef.current = now;
  }, [isPaused]);

  const gotoQuestion = useCallback(
    (idx) => {
      if (isPaused || idx < 0 || idx >= totalQuestions) return false;
      updateTimeSpent();
      currentQuestionIndexRef.current = idx;
      questionStartTimeRef.current = Date.now();
      return true;
    },
    [isPaused, totalQuestions, updateTimeSpent]
  );

  const navigateQuestions = useCallback(
    (step) => {
      const next = currentQuestionIndexRef.current + step;
      if (next >= 0 && next < totalQuestions) {
        return gotoQuestion(next);
      }
      return false;
    },
    [totalQuestions, gotoQuestion]
  );

  const resetTimeTracking = useCallback(() => {
    questionStartTimeRef.current = Date.now();
  }, []);

  return {
    getCurrentIndex,
    gotoQuestion,
    navigateQuestions,
    updateTimeSpent,
    resetTimeTracking,
    questionTimeSpent: questionTimeSpentRef.current,
  };
}
