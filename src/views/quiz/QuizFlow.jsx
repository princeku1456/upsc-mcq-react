import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useApp } from "../../store";
import { DataManager } from "../../lib/dataManager";
import { toastr } from "../../lib/toastr";
import { QUIZ_PHASES, QUIZ_DATA_PREFIX } from "../../config/constants";
import { useQuizTimer } from "../../hooks/useQuizTimer";
import { useQuizNavigation } from "../../hooks/useQuizNavigation";
import { useQuizPersistence } from "../../hooks/useQuizPersistence";
import { useQuizSubmission } from "../../hooks/useQuizSubmission";
import QuizLoading from "./QuizLoading";
import QuizStartModal from "./QuizStartModal";
import QuizActive from "./QuizActive";
import ReviewMode from "../review/ReviewMode";

export default function QuizFlow() {
  const { currentUser, viewParams, showDashboard, showChapters } = useApp();

  const [phase, setPhase] = useState(QUIZ_PHASES.LOADING);
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

  const savedTimeRef = useRef(null);
  const submitAllRef = useRef(() => {});

  const { timerDisplay, isPaused: isTimerPaused, start: startTimer, toggle: toggleTimerHook, stop: stopTimer, getTimeLeft } =
    useQuizTimer(s.currentQuizData.length || 1);

  const { getCurrentIndex, gotoQuestion: navigateToIndex, navigateQuestions: stepNavigation, updateTimeSpent, resetTimeTracking, questionTimeSpent } =
    useQuizNavigation(s.currentQuizData.length || 1, isTimerPaused);

  const { saveProgress, clearProgress, restoreProgress } = useQuizPersistence();
  const { submit: submitToFirebase } = useQuizSubmission(s);

  const syncNavToStore = useCallback(() => {
    s.currentQuestionIndex = getCurrentIndex();
    s.questionTimeSpent = questionTimeSpent;
  }, [getCurrentIndex, questionTimeSpent, s]);

  const saveQuizProgressNow = useCallback(() => {
    saveProgress(s.currentChapterId, s.userAnswers, s.markedForReview, getCurrentIndex(), questionTimeSpent, getTimeLeft, s.quizSubmitted);
  }, [s, getCurrentIndex, questionTimeSpent, getTimeLeft, saveProgress]);

  const startQuizExecution = useCallback((resumedTimeLeft) => {
    setPhase(QUIZ_PHASES.ACTIVE);
    resetTimeTracking();
    startTimer(resumedTimeLeft, () => {
      toastr.warning("Time's up! Auto-submitting...");
      submitAllRef.current(true);
    });
  }, [startTimer, resetTimeTracking]);

  const toggleTimer = useCallback(() => {
    if (s.quizSubmitted) return;
    if (isTimerPaused) {
      toggleTimerHook();
      resetTimeTracking();
      toastr.success("Timer Resumed");
    } else {
      updateTimeSpent();
      toggleTimerHook();
      toastr.warning("Timer Paused. Options disabled.");
    }
  }, [s.quizSubmitted, isTimerPaused, toggleTimerHook, resetTimeTracking, updateTimeSpent]);

  const submitAll = useCallback((forceSubmit = false) => {
    if (!forceSubmit && !window.confirm("Are you sure you want to submit?")) return;
    stopTimer();
    updateTimeSpent();
    syncNavToStore();
    clearProgress(s.currentChapterId);
    submitToFirebase(forceSubmit).then(() => forceUpdate());
  }, [stopTimer, updateTimeSpent, syncNavToStore, clearProgress, submitToFirebase, s]);
  submitAllRef.current = submitAll;

  const loadQuiz = useCallback(
    async (subj, chapId, chapName, skipModal = false, pastData = null) => {
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
          qData = DataManager.cache[`${QUIZ_DATA_PREFIX}${chapId}`];
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
          setPhase(QUIZ_PHASES.REVIEW);
          return;
        }

        const savedProgress = restoreProgress(chapId);
        if (savedProgress && !chapId.startsWith("revision_")) {
          s.userAnswers = savedProgress.userAnswers || {};
          s.markedForReview = savedProgress.markedForReview || {};
          s.questionTimeSpent = savedProgress.questionTimeSpent || {};
          Object.assign(questionTimeSpent, savedProgress.questionTimeSpent || {});
          savedTimeRef.current = savedProgress.timeLeft;
          if (savedProgress.currentIndex !== undefined) {
            navigateToIndex(savedProgress.currentIndex);
            syncNavToStore();
          }
        } else {
          savedTimeRef.current = null;
        }

        if (skipModal) {
          startQuizExecution(savedTimeRef.current);
        } else {
          setPhase(QUIZ_PHASES.START_MODAL);
        }
      } catch (err) {
        console.error(err);
        toastr.error("Failed to load quiz.");
        showChapters(subj);
      }
    },
    [s, showChapters, restoreProgress, navigateToIndex, syncNavToStore, questionTimeSpent, startQuizExecution]
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
    if (!s.quizSubmitted && phase === QUIZ_PHASES.ACTIVE) {
      updateTimeSpent();
      syncNavToStore();
      saveQuizProgressNow();
    }
    stopTimer();
    const r = viewParams.referrer;
    if (r === "dashboard") showDashboard();
    else if (r === "chapters" || r === "subjects") showChapters(s.currentSubject);
    else showDashboard();
  }, [s, phase, viewParams.referrer, updateTimeSpent, syncNavToStore, saveQuizProgressNow, stopTimer, showDashboard, showChapters]);

  const gotoQuestion = useCallback((idx) => {
    if (navigateToIndex(idx)) { syncNavToStore(); forceUpdate(); }
  }, [navigateToIndex, syncNavToStore]);

  const navigateQuestions = useCallback((step) => {
    if (stepNavigation(step)) { syncNavToStore(); forceUpdate(); }
  }, [stepNavigation, syncNavToStore]);

  const selectAnswer = useCallback((idx) => {
    if (s.quizSubmitted) return;
    if (!s.userAnswers[s.currentQuestionIndex]) {
      s.userAnswers[s.currentQuestionIndex] = { answer: idx, surety: 100 };
    } else {
      s.userAnswers[s.currentQuestionIndex].answer = idx;
    }
    saveQuizProgressNow();
    forceUpdate();
  }, [s, saveQuizProgressNow]);

  const selectSurety = useCallback((val) => {
    if (s.quizSubmitted) return;
    if (!s.userAnswers[s.currentQuestionIndex]) return;
    s.userAnswers[s.currentQuestionIndex].surety = val;
    saveQuizProgressNow();
    forceUpdate();
  }, [s, saveQuizProgressNow]);

  const clearSelection = useCallback(() => {
    if (s.quizSubmitted) return;
    delete s.userAnswers[s.currentQuestionIndex];
    saveQuizProgressNow();
    forceUpdate();
  }, [s, saveQuizProgressNow]);

  const toggleMarkForReview = useCallback(() => {
    if (s.quizSubmitted) return;
    if (s.markedForReview[s.currentQuestionIndex]) {
      delete s.markedForReview[s.currentQuestionIndex];
    } else {
      s.markedForReview[s.currentQuestionIndex] = true;
    }
    saveQuizProgressNow();
    forceUpdate();
  }, [s, saveQuizProgressNow]);

  const reviewAfterSubmit = useCallback(() => {
    loadQuiz(s.currentSubject, s.currentChapterId, s.currentChapterName, true, s.submittedResult.resultObject, "chapters");
  }, [s, loadQuiz]);

  if (phase === QUIZ_PHASES.LOADING) return <QuizLoading />;

  if (phase === QUIZ_PHASES.START_MODAL) {
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

  if (phase === QUIZ_PHASES.REVIEW) {
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
      currentQuestionIndex={getCurrentIndex()}
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
