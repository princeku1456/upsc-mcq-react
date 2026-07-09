import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useApp } from "../../store";
import { DataManager } from "../../lib/dataManager";
import { toastr } from "../../lib/toastr";
import { MAX_USER_HISTORY } from "../../config/constants";
import { firebaseService } from "../../services/firebaseService";
import { quizService } from "../../services/quizService";
import { QuizTimer } from "../../lib/timer";
import QuizLoading from "./QuizLoading";
import QuizStartModal from "./QuizStartModal";
import QuizActive from "./QuizActive";
import ReviewMode from "../review/ReviewMode";

export default function QuizFlow() {
  const { g, currentUser, viewParams, showDashboard, showChapters, bumpHistory } = useApp();

  const [phase, setPhase] = useState("loading");
  const [timerDisplay, setTimerDisplay] = useState({ text: "00:00", low: false });
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  const s = useRef({
    currentSubject: "",
    currentChapterId: "",
    currentChapterName: "",
    currentQuizData: [],
    userAnswers: {},
    markedForReview: {},
    questionTimeSpent: {},
    currentQuestionIndex: 0,
    quizSubmitted: false,
    submittedResult: null,
    statsLine: null,
  }).current;

  const timerRef = useRef(null);
  const questionStartTimeRef = useRef(Date.now());
  const savedTimeRef = useRef(null);
  const submitAllRef = useRef(() => {});

  const updateQuestionTimer = useCallback(() => {
    if (isTimerPaused || s.quizSubmitted) return;
    const now = Date.now();
    const spent = Math.floor((now - questionStartTimeRef.current) / 1000);
    s.questionTimeSpent[s.currentQuestionIndex] =
      (s.questionTimeSpent[s.currentQuestionIndex] || 0) + spent;
    questionStartTimeRef.current = now;
  }, [s, isTimerPaused]);

  const saveQuizProgress = useCallback(() => {
    if (!s.currentChapterId || s.currentChapterId.startsWith("revision_") || s.quizSubmitted) return;
    try {
      const p = {
        userAnswers: s.userAnswers,
        markedForReview: s.markedForReview,
        timeLeft: timerRef.current ? timerRef.current.getTimeLeft() : null,
        currentIndex: s.currentQuestionIndex,
        questionTimeSpent: s.questionTimeSpent,
      };
      const key = `quiz_progress_${s.currentChapterId}`;
      DataManager.cache[key] = JSON.stringify(p);
      localStorage.setItem(key, JSON.stringify(p));
    } catch (e) {
      console.error("Save progress failed", e);
    }
  }, [s]);

  const clearQuizProgress = useCallback((chapId) => {
    const key = `quiz_progress_${chapId}`;
    delete DataManager.cache[key];
    localStorage.removeItem(key);
  }, []);

  const toggleTimer = () => {
    if (s.quizSubmitted) return;
    if (isTimerPaused) {
      if (timerRef.current) timerRef.current.resume();
      setIsTimerPaused(false);
      questionStartTimeRef.current = Date.now();
      toastr.success("Timer Resumed");
    } else {
      updateQuestionTimer();
      if (timerRef.current) timerRef.current.pause();
      setIsTimerPaused(true);
      toastr.warning("Timer Paused. Options disabled.");
    }
  };

  const startQuizExecution = (resumedTimeLeft) => {
    setPhase("active");
    questionStartTimeRef.current = Date.now();

    const limit = s.currentQuizData.length * 90;
    const initialTime = resumedTimeLeft !== null ? resumedTimeLeft : limit;

    timerRef.current = new QuizTimer(
      (text, low) => setTimerDisplay({ text, low }),
      null,
      () => {
        toastr.warning("Time's up! Auto-submitting...");
        submitAllRef.current(true);
      }
    );
    timerRef.current.start(initialTime);
  };

  const loadQuiz = useCallback(
    async (subj, chapId, chapName, skipModal = false, pastData = null, referrer = null) => {
      const subjectPrefix = subj ? subj.replace(/\s+/g, "_") : "";
      const fullChapId = chapId && subjectPrefix && !chapId.startsWith("revision_")
        ? (chapId.includes(subjectPrefix) ? chapId : `${subjectPrefix}_${chapId}`)
        : chapId;

      const displayName = typeof chapName === "string" ? chapName : (chapId || "");

      s.currentSubject = subj;
      s.currentChapterId = fullChapId || chapId;
      s.currentChapterName = displayName;
      s.userAnswers = {};
      s.markedForReview = {};
      s.questionTimeSpent = {};
      s.currentQuestionIndex = 0;
      s.quizSubmitted = false;
      s.submittedResult = null;

      if (!chapId) return;

      try {
        let qData = [];
        if (chapId.startsWith("revision_")) {
          qData = DataManager.cache[`quiz_data_${chapId}`];
          if (!qData) throw new Error("Revision data lost.");
        } else {
          qData = await DataManager.fetchQuizQuestions(chapId);
        }

        if (!qData) {
          toastr.error("Failed to load questions. Check your internet connection.");
          showChapters(subj);
          return;
        }

        if (qData.length === 0) {
          toastr.error("No questions found in this test.");
          showChapters(subj);
          return;
        }
        s.currentQuizData = qData;

        if (pastData) {
          s.quizSubmitted = true;
          s.userAnswers = pastData.userAnswers || {};
          s.questionTimeSpent = pastData.questionTimeSpent || {};
          s.submittedResult = { resultObject: pastData };
          setPhase("review");
          return;
        }

        const progKey = `quiz_progress_${chapId}`;
        const savedProgStr = DataManager.cache[progKey] || localStorage.getItem(progKey);

        if (savedProgStr && !chapId.startsWith("revision_")) {
          const p = JSON.parse(savedProgStr);
          s.userAnswers = p.userAnswers || {};
          s.markedForReview = p.markedForReview || {};
          s.currentQuestionIndex = p.currentIndex || 0;
          s.questionTimeSpent = p.questionTimeSpent || {};
          savedTimeRef.current = p.timeLeft;
        } else {
          savedTimeRef.current = null;
        }

        if (skipModal) {
          startQuizExecution(savedTimeRef.current);
        } else {
          setPhase("startModal");
        }
      } catch (err) {
        console.error(err);
        toastr.error("Failed to load quiz.");
        showChapters(subj);
      }
    },
    [s, showChapters]
  );

  useEffect(() => {
    loadQuiz(
      viewParams.subjectKey,
      viewParams.chapterId,
      viewParams.chapterName,
      viewParams.reviewMode,
      viewParams.pastData,
      viewParams.source
    );
  }, [viewParams, loadQuiz]);

  const exitQuiz = useCallback(() => {
    if (!s.quizSubmitted && phase === "active") {
      updateQuestionTimer();
      saveQuizProgress();
    }
    if (timerRef.current) {
      timerRef.current.stop();
      timerRef.current = null;
    }
    const r = viewParams.referrer;
    if (r === "dashboard") showDashboard();
    else if (r === "chapters" || r === "subjects") showChapters(s.currentSubject);
    else showDashboard();
  }, [s, phase, viewParams.referrer, updateQuestionTimer, saveQuizProgress, showDashboard, showChapters]);

  const gotoQuestion = (idx) => {
    if (isTimerPaused) return;
    updateQuestionTimer();
    s.currentQuestionIndex = idx;
    questionStartTimeRef.current = Date.now();
    forceUpdate();
  };

  const navigateQuestions = (step) => {
    if (isTimerPaused) return;
    const n = s.currentQuestionIndex + step;
    if (n >= 0 && n < s.currentQuizData.length) {
      gotoQuestion(n);
    }
  };

  const selectAnswer = (idx) => {
    if (s.quizSubmitted) return;
    if (!s.userAnswers[s.currentQuestionIndex]) {
      s.userAnswers[s.currentQuestionIndex] = { answer: idx, surety: 100 };
    } else {
      s.userAnswers[s.currentQuestionIndex].answer = idx;
    }
    saveQuizProgress();
    forceUpdate();
  };

  const selectSurety = (val) => {
    if (s.quizSubmitted) return;
    if (!s.userAnswers[s.currentQuestionIndex]) return;
    s.userAnswers[s.currentQuestionIndex].surety = val;
    saveQuizProgress();
    forceUpdate();
  };

  const clearSelection = () => {
    if (s.quizSubmitted) return;
    delete s.userAnswers[s.currentQuestionIndex];
    saveQuizProgress();
    forceUpdate();
  };

  const toggleMarkForReview = () => {
    if (s.quizSubmitted) return;
    if (s.markedForReview[s.currentQuestionIndex]) {
      delete s.markedForReview[s.currentQuestionIndex];
    } else {
      s.markedForReview[s.currentQuestionIndex] = true;
    }
    saveQuizProgress();
    forceUpdate();
  };

  const submitAll = useCallback(
    (forceSubmit = false) => {
      if (!forceSubmit && !window.confirm("Are you sure you want to submit?")) return;

      if (timerRef.current) timerRef.current.stop();
      updateQuestionTimer();

      s.quizSubmitted = true;
      clearQuizProgress(s.currentChapterId);

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

      s.submittedResult = { correct, incorrect, unattempted, finalScore, totalMarks, percentage, resultObject };
      s.statsLine = null;
      forceUpdate();

      if (currentUser) {
        firebaseService.submitResult(resultObject).then(async (docId) => {
          leaderboardEntry.resultId = docId;
          g.userHistory.unshift({ ...resultObject, timestamp: now });
          if (g.userHistory.length > MAX_USER_HISTORY) g.userHistory.pop();
          g.dashboardDataLoaded = true;
          bumpHistory();

          await DataManager.invalidateCache(`global_stats_${s.currentChapterId}`);
          await DataManager.invalidateCache(`user_history_${currentUser.uid}`);

          if (!s.currentChapterId.startsWith("revision_")) {
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
            forceUpdate();
          }
        });
      }
    },
    [s, currentUser, g, updateQuestionTimer, clearQuizProgress, bumpHistory]
  );
  submitAllRef.current = submitAll;

  const reviewAfterSubmit = () => {
    loadQuiz(
      s.currentSubject,
      s.currentChapterId,
      s.currentChapterName,
      true,
      s.submittedResult.resultObject,
      "chapters"
    );
  };

  if (phase === "loading") return <QuizLoading />;

  if (phase === "startModal") {
    return (
      <QuizStartModal
        subject={s.currentSubject}
        chapterName={s.currentChapterName}
        questionCount={s.currentQuizData.length}
        hasResumeData={savedTimeRef.current !== null}
        onStart={() => startQuizExecution(savedTimeRef.current)}
        onCancel={() => showChapters(s.currentSubject)}
      />
    );
  }

  if (phase === "review") {
    return (
      <div className="page" style={{ maxWidth: 1200 }}>
        <ReviewMode
          quizData={s.currentQuizData}
          userAnswers={s.userAnswers}
          questionTimeSpent={s.questionTimeSpent}
          resultData={viewParams.pastData}
          chapterId={s.currentChapterId}
          chapterName={s.currentChapterName}
          onExit={exitQuiz}
        />
      </div>
    );
  }

  return (
    <QuizActive
      quizData={s.currentQuizData}
      currentQuestionIndex={s.currentQuestionIndex}
      userAnswers={s.userAnswers}
      markedForReview={s.markedForReview}
      isSubmitted={s.quizSubmitted}
      isTimerPaused={isTimerPaused}
      timerDisplay={timerDisplay}
      timerLow={false}
      result={s.submittedResult}
      statsLine={s.statsLine}
      onSelectAnswer={selectAnswer}
      onSelectSurety={selectSurety}
      onClearSelection={clearSelection}
      onToggleMarkForReview={toggleMarkForReview}
      onNavigateQuestions={navigateQuestions}
      onToggleTimer={toggleTimer}
      onSelectQuestion={gotoQuestion}
      onSubmit={submitAll}
      onReview={reviewAfterSubmit}
    />
  );
}
