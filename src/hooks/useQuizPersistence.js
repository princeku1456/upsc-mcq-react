import { useCallback } from "react";
import { DataManager } from "../lib/dataManager";
import { QUIZ_STORAGE_PREFIX, REVISION_PREFIX } from "../config/constants";

export function useQuizPersistence() {
  const saveProgress = useCallback((chapterId, userAnswers, markedForReview, currentIndex, questionTimeSpent, getTimeLeft, isSubmitted) => {
    if (!chapterId || chapterId.startsWith(REVISION_PREFIX) || isSubmitted) return;
    try {
      const p = {
        userAnswers,
        markedForReview,
        timeLeft: getTimeLeft(),
        currentIndex,
        questionTimeSpent: { ...questionTimeSpent },
      };
      const key = `${QUIZ_STORAGE_PREFIX}${chapterId}`;
      DataManager.cache[key] = JSON.stringify(p);
      localStorage.setItem(key, JSON.stringify(p));
    } catch (e) {
      console.error("Save progress failed", e);
    }
  }, []);

  const clearProgress = useCallback((chapterId) => {
    const key = `${QUIZ_STORAGE_PREFIX}${chapterId}`;
    delete DataManager.cache[key];
    localStorage.removeItem(key);
  }, []);

  const restoreProgress = useCallback((chapterId) => {
    if (!chapterId || chapterId.startsWith(REVISION_PREFIX)) return null;
    const key = `${QUIZ_STORAGE_PREFIX}${chapterId}`;
    const raw = DataManager.cache[key] || localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }, []);

  return { saveProgress, clearProgress, restoreProgress };
}
