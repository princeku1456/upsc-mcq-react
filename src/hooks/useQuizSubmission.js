import { useCallback } from "react";
import { useApp } from "../store";
import { DataManager } from "../lib/dataManager";
import { toastr } from "../lib/toastr";
import { MAX_USER_HISTORY, REVISION_PREFIX } from "../config/constants";
import { firebaseService } from "../services/firebaseService";
import { quizService } from "../services/quizService";

export function useQuizSubmission(stateRef) {
  const { g, currentUser, bumpHistory } = useApp();

  const submit = useCallback(async (forceSubmit = false) => {
    const s = stateRef.current;
    if (!forceSubmit && !window.confirm("Are you sure you want to submit?")) return null;

    const { finalScore, totalMarks, percentage, correct, incorrect, unattempted } =
      quizService.calculateScore(s.userAnswers, s.currentQuizData);

    const now = new Date();

    const leaderboardEntry = {
      userEmail: currentUser ? currentUser.email : "guest",
      scorePercent: parseFloat(percentage),
      score: finalScore,
      rankTime: now.toISOString(),
    };

    const resultObject = {
      userId: currentUser ? currentUser.uid : "guest",
      userEmail: currentUser ? currentUser.email : "guest",
      subject: s.currentSubject,
      chapterId: s.currentChapterId,
      chapterName: s.currentChapterName,
      score: finalScore,
      totalMarks,
      scorePercent: parseFloat(percentage),
      userAnswers: s.userAnswers,
      questionTimeSpent: s.questionTimeSpent,
      timestamp: now,
    };

    const submittedResult = { correct, incorrect, unattempted, finalScore, totalMarks, percentage, resultObject };
    s.submittedResult = submittedResult;
    s.quizSubmitted = true;
    s.statsLine = null;

    if (currentUser) {
      try {
        const docId = await firebaseService.submitResult(resultObject);
        leaderboardEntry.resultId = docId;
        g.userHistory.unshift({ ...resultObject, timestamp: now });
        if (g.userHistory.length > MAX_USER_HISTORY) g.userHistory.pop();
        g.dashboardDataLoaded = true;
        bumpHistory();

        await DataManager.invalidateCache(`global_stats_${s.currentChapterId}`);
        await DataManager.invalidateCache(`user_history_${currentUser.uid}`);

        if (!s.currentChapterId.startsWith(REVISION_PREFIX)) {
          try {
            await firebaseService.updateChapterStats(
              s.currentChapterId, percentage, leaderboardEntry, s.currentQuizData, s.userAnswers
            );
            toastr.success("Result and stats saved!");
          } catch (e) {
            console.error("Stats update failed:", e);
          }
        } else {
          toastr.success("Revision test result saved!");
        }

        const stats = await DataManager.fetchGlobalStats(s.currentChapterId, true);
        if (stats) {
          let betterThan = 0;
          const pct = parseFloat(percentage);
          for (let k = 0; k < stats.allScores.length; k++) {
            if (stats.allScores[k] < pct) betterThan++;
          }
          const percentile = stats.totalAttempts > 0
            ? ((betterThan / stats.totalAttempts) * 100).toFixed(0) : 0;
          s.statsLine = `🌍 Class Performance: Top <strong>${100 - percentile}%</strong>. (Avg: ${stats.avg.toFixed(1)}%)`;
        }
      } catch (e) {
        console.error("Submission failed:", e);
      }
    }

    return submittedResult;
  }, [currentUser, g, bumpHistory]);

  return { submit };
}
