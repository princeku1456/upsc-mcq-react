import { useRef, useCallback } from "react";

export function useQuizNavigation(totalQuestions, isPaused) {
  const currentQuestionIndexRef = useRef(0);
  const questionStartTimeRef = useRef(Date.now());
  const questionTimeSpentRef = useRef({});
  const totalRef = useRef(totalQuestions);
  const pausedRef = useRef(isPaused);
  totalRef.current = totalQuestions;
  pausedRef.current = isPaused;

  const getCurrentIndex = useCallback(() => currentQuestionIndexRef.current, []);

  const updateTimeSpent = useCallback(() => {
    if (pausedRef.current) return;
    const now = Date.now();
    const idx = currentQuestionIndexRef.current;
    const spent = Math.floor((now - questionStartTimeRef.current) / 1000);
    questionTimeSpentRef.current[idx] =
      (questionTimeSpentRef.current[idx] || 0) + spent;
    questionStartTimeRef.current = now;
  }, []);

  const gotoQuestion = useCallback(
    (idx) => {
      if (pausedRef.current || idx < 0 || idx >= totalRef.current) return false;
      updateTimeSpent();
      currentQuestionIndexRef.current = idx;
      questionStartTimeRef.current = Date.now();
      return true;
    },
    [updateTimeSpent]
  );

  const navigateQuestions = useCallback(
    (step) => {
      const next = currentQuestionIndexRef.current + step;
      if (next >= 0 && next < totalRef.current) {
        return gotoQuestion(next);
      }
      return false;
    },
    [gotoQuestion]
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
