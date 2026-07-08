/* =========================================
   5–7. QUIZ CORE, TIMER & NAVIGATION, SUBMIT & STATISTICS
   Ported from quiz.js. Every calculation, Firestore write,
   localStorage key and timing rule is unchanged.
   ========================================= */
import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import firebase, { db } from "../lib/firebase";
import { useApp } from "../store";
import { DataManager } from "../lib/dataManager";
import { QuizTimer } from "../lib/timer";
import { getCorrectIndex, TextFormatter } from "../lib/helpers";
import { toastr } from "../lib/toastr";
import ReviewMode from "./ReviewMode";
import PracticeRunner from "./PracticeRunner";

/* ---------- Start Quiz Modal (showStartModal/updateStartModal) ---------- */
function StartQuizModal({ subject, chapter, numQuestions, savedTime, onStart, onCancel }) {
  const ready = numQuestions !== null;
  // Calculate duration: 1.2 min per question
  const durationMin = ready ? Math.ceil(numQuestions * 1.2) : null;

  return (
    <div className="app-modal-backdrop">
      <div className="modal-dialog modal-dialog-centered app-modal-dialog">
        <div className="modal-content border-0 shadow-lg rounded-4">
          <div className="modal-header border-0 bg-light rounded-top-4">
            <h5 className="modal-title fw-bold text-primary">Ready to Start?</h5>
          </div>
          <div className="modal-body p-4 text-center">
            <div className="mb-4">
              <div className="display-1 mb-3">📝</div>
              <h4 className="fw-bold mb-2">{subject}</h4>
              <p className="text-muted">{chapter}</p>
            </div>

            <div className="row g-3 justify-content-center mb-4">
              <div className="col-6">
                <div className="p-3 bg-light rounded-3 border">
                  <small className="text-muted d-block text-uppercase fw-bold" style={{ fontSize: "0.7rem" }}>
                    Questions
                  </small>
                  <span className="fs-4 fw-bold text-dark">
                    {ready ? (
                      numQuestions
                    ) : (
                      <span className="spinner-border spinner-border-sm text-primary" role="status"></span>
                    )}
                  </span>
                </div>
              </div>
              <div className="col-6">
                <div className="p-3 bg-light rounded-3 border">
                  <small className="text-muted d-block text-uppercase fw-bold" style={{ fontSize: "0.7rem" }}>
                    Duration
                  </small>
                  <span className="fs-4 fw-bold text-dark">
                    {ready ? (
                      durationMin + "m"
                    ) : (
                      <span className="spinner-border spinner-border-sm text-primary" role="status"></span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="alert alert-info border-0 d-flex align-items-center" role="alert">
              <i className="bi bi-info-circle-fill me-2 fs-5"></i>
              <div className="small text-start">
                Once you start, the timer will begin. Good luck!
              </div>
            </div>
          </div>
          <div className="modal-footer border-0 justify-content-center pb-4">
            <button type="button" className="btn btn-secondary-custom px-4" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className={`btn btn-primary-custom px-5 shadow pulse-button ${!ready ? "disabled" : ""}`}
              disabled={!ready}
              onClick={() => onStart(savedTime)}
            >
              🚀 Start Test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================
   TEST / REVISION FLOW
   ========================================= */
export default function QuizFlow() {
  const app = useApp();
  const { viewParams } = app;

  if (viewParams.mode === "practice") {
    // Practice mode lives in its own runner (practice.js port)
    return <PracticeRunner key={viewParams.key} />;
  }

  return <TestFlow key={viewParams.key} />;
}

function TestFlow() {
  const {
    g,
    currentUser,
    viewParams,
    showHome,
    showDashboard,
    showTestSelection,
    showChapters,
    showPerformance,
    loadQuiz,
    bumpHistory,
  } = useApp();

  const isRevision = viewParams.mode === "revision";

  /* ---- module-level globals from auth.js/quiz.js, held in refs ---- */
  const s = useRef({
    currentSubject: viewParams.subjectKey,
    currentChapterId: isRevision
      ? "revision_" + Date.now()
      : viewParams.subjectKey.replace(/\s+/g, "_") + "_" + viewParams.chapterId,
    currentChapterName: isRevision
      ? "Revision Test"
      : decodeURIComponent(viewParams.chapterName),
    currentQuizData: isRevision ? viewParams.questions : [],
    currentQuestionIndex: 0,
    userAnswers: {},
    markedForReview: {},
    questionTimeSpent: {},
    currentQuestionStartTime: null,
    quizSubmitted: false,
    isReviewMode: !!viewParams.reviewMode,
    reviewSource: viewParams.source || null,
    currentTimerSeconds: 0,
    isTimerPaused: false,
    submittedResult: null,
    statsLine: null, // "Calculating class standing..." replacement content
  }).current;

  const timerRef = useRef(null);
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  const [phase, setPhase] = useState(
    isRevision ? "active" : s.isReviewMode ? "loading" : "loading"
  ); // loading | startModal | active | review | error
  const [timerDisplay, setTimerDisplay] = useState({ text: "", low: false });
  const savedTimeRef = useRef(null);

  /* ---------- Time tracking helpers (verbatim) ---------- */
  const updateQuestionTimer = useCallback(() => {
    if (!s.currentQuestionStartTime || s.quizSubmitted || s.isReviewMode) return;

    const now = Date.now();
    const elapsed = (now - s.currentQuestionStartTime) / 1000; // seconds

    s.questionTimeSpent[s.currentQuestionIndex] =
      (s.questionTimeSpent[s.currentQuestionIndex] || 0) + elapsed;
    s.currentQuestionStartTime = now;
  }, [s]);

  const saveQuizProgress = useCallback(() => {
    if (!s.currentChapterId || s.quizSubmitted || s.isReviewMode) return;

    // Update time for current question without resetting start time (just for saving)
    let currentQTime = 0;
    if (s.currentQuestionStartTime) {
      currentQTime = (Date.now() - s.currentQuestionStartTime) / 1000;
    }

    const timeData = { ...s.questionTimeSpent };
    timeData[s.currentQuestionIndex] =
      (timeData[s.currentQuestionIndex] || 0) + currentQTime;

    const progressData = {
      userAnswers: s.userAnswers,
      markedForReview: s.markedForReview,
      questionTimeSpent: timeData, // Save time tracking
      lastQuestionIndex: s.currentQuestionIndex,
      remainingTime: s.currentTimerSeconds, // Save the current timer state
      timestamp: new Date().getTime(),
    };
    localStorage.setItem(
      `quiz_progress_${s.currentChapterId}`,
      JSON.stringify(progressData)
    );
  }, [s]);

  const clearQuizProgress = useCallback((chapterId) => {
    localStorage.removeItem(`quiz_progress_${chapterId}`);
  }, []);

  /* ---------- Timer (startTimer, verbatim rules) ---------- */
  const submitAllRef = useRef(() => {});
  const startTimer = useCallback(
    (numQuestions, savedTime = null) => {
      s.currentTimerSeconds =
        savedTime !== null && savedTime !== undefined
          ? savedTime
          : Math.floor(numQuestions * 1.2 * 60);
      s.isTimerPaused = false;

      if (timerRef.current) timerRef.current.stop();

      timerRef.current = new QuizTimer(
        (text, low) => setTimerDisplay({ text, low }),
        (seconds) => {
          s.currentTimerSeconds = seconds;
          saveQuizProgress();
        },
        () => {
          toastr.warning("Time's up! Submitting test...");
          submitAllRef.current(true);
        }
      );

      timerRef.current.start(s.currentTimerSeconds);
    },
    [s, saveQuizProgress]
  );

  const toggleTimer = useCallback(() => {
    if (!timerRef.current) return;

    if (timerRef.current.isPaused) {
      timerRef.current.resume();
      s.isTimerPaused = false;
      toastr.success("Timer Resumed");
    } else {
      timerRef.current.pause();
      s.isTimerPaused = true;
      toastr.info("Timer Paused");
    }
    forceUpdate();
  }, [s]);



  /* ---------- loadQuiz body (fetch questions, restore progress) ---------- */
  useEffect(() => {
    if (isRevision) {
      // startRevisionTestExecution (verbatim state reset)
      g.isPracticeMode = false;
      s.quizSubmitted = false;
      s.currentQuestionIndex = 0;
      s.userAnswers = {};
      s.markedForReview = {};
      s.questionTimeSpent = {};
      s.currentQuestionStartTime = null;

      setPhase("active");
      startTimer(s.currentQuizData.length, null);
      s.currentQuestionStartTime = Date.now();
      forceUpdate();
      return () => {
        if (timerRef.current) timerRef.current.stop();
      };
    }

    let cancelled = false;
    async function run() {
      try {
        const data = await DataManager.fetchQuizQuestions(s.currentChapterId);
        if (cancelled) return;
        if (!data) {
          toastr.error("Quiz questions not found in database!");
          showDashboard();
          return;
        }
        s.currentQuizData = data;

        s.currentQuestionIndex = 0;
        s.userAnswers = {};
        s.markedForReview = {};
        s.questionTimeSpent = {};
        s.currentQuestionStartTime = null;
        s.quizSubmitted = false;

        let savedTime = null;
        if (!s.isReviewMode) {
          const savedProgress = localStorage.getItem(
            `quiz_progress_${s.currentChapterId}`
          );
          if (savedProgress) {
            const parsedProgress = JSON.parse(savedProgress);
            const oneDay = 24 * 60 * 60 * 1000;
            if (new Date().getTime() - parsedProgress.timestamp < oneDay) {
              s.userAnswers = parsedProgress.userAnswers || {};
              s.markedForReview = parsedProgress.markedForReview || {};
              s.questionTimeSpent = parsedProgress.questionTimeSpent || {};
              s.currentQuestionIndex = parsedProgress.lastQuestionIndex || 0;
              savedTime = parsedProgress.remainingTime; // Restore the time value
              toastr.info("Restored your previous progress and time.");
            }
          }
        }

        if (timerRef.current) timerRef.current.stop();

        if (s.isReviewMode && viewParams.pastData) {
          s.userAnswers = viewParams.pastData.userAnswers || {};
          s.questionTimeSpent = viewParams.pastData.questionTimeSpent || {};
          s.quizSubmitted = true;
        }

        if (s.isReviewMode) {
          setPhase("review");
        } else {
          savedTimeRef.current = savedTime;
          setPhase("startModal");
        }
        forceUpdate();
      } catch (error) {
        console.error("Firebase fetch error:", error);
        toastr.error("Failed to load questions.");
        showDashboard();
      }
    }
    run();
    return () => {
      cancelled = true;
      if (timerRef.current) timerRef.current.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- startQuizExecution ---------- */
  const startQuizExecution = useCallback(
    (savedTime) => {
      setPhase("active");
      startTimer(s.currentQuizData.length, savedTime ?? null);
      s.currentQuestionStartTime = Date.now(); // Start tracking first question
      forceUpdate();
    },
    [s, startTimer]
  );

  /* ---------- exitQuiz (verbatim routing) ---------- */
  const exitQuiz = useCallback(() => {
    if (timerRef.current) timerRef.current.stop();

    if (s.isReviewMode && s.reviewSource === "performance") {
      showPerformance();
    } else if (
      s.currentSubject &&
      (DataManager.cache.quizManifest || window.allQuizData || {})[s.currentSubject]
    ) {
      showChapters(s.currentSubject);
    } else {
      // Safety Fallback
      showDashboard();
    }
  }, [s, showPerformance, showChapters, showDashboard]);

  /* ---------- answer / nav actions (verbatim behaviour) ---------- */
  const selectAnswer = (idx) => {
    if (!s.userAnswers[s.currentQuestionIndex])
      s.userAnswers[s.currentQuestionIndex] = {};
    s.userAnswers[s.currentQuestionIndex].answer = idx;
    saveQuizProgress();
    forceUpdate();
  };

  const selectSurety = (val) => {
    if (!s.userAnswers[s.currentQuestionIndex])
      s.userAnswers[s.currentQuestionIndex] = { answer: -1 };
    s.userAnswers[s.currentQuestionIndex].surety = val;
    saveQuizProgress();
    forceUpdate();
  };

  const navigateQuestions = (dir) => {
    const next = s.currentQuestionIndex + dir;
    if (next >= 0 && next < s.currentQuizData.length) {
      updateQuestionTimer(); // Save time for current question
      s.currentQuestionIndex = next;
      saveQuizProgress();
      forceUpdate();
    }
  };

  const gotoQuestion = (i) => {
    updateQuestionTimer(); // Save time for current question
    s.currentQuestionIndex = i;
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
      toastr.info("Removed from Review");
    } else {
      s.markedForReview[s.currentQuestionIndex] = true;
      toastr.success("Marked for Review");
    }
    saveQuizProgress();
    forceUpdate();
  };

  /* =========================================
     7. SUBMIT & STATISTICS (submitAll, verbatim)
     ========================================= */
  const submitAll = useCallback(
    (forceSubmit = false) => {
      if (!forceSubmit && !window.confirm("Are you sure you want to submit?"))
        return;

      if (timerRef.current) timerRef.current.stop();
      updateQuestionTimer(); // Finalize time for the last question

      s.quizSubmitted = true;
      clearQuizProgress(s.currentChapterId);

      let score = 0;
      let correct = 0,
        incorrect = 0,
        unattempted = 0;
      const totalQ = s.currentQuizData.length;

      s.currentQuizData.forEach((q, i) => {
        const uAns = s.userAnswers[i];
        const cIdx = getCorrectIndex(q);

        if (uAns) {
          const isCorrect = uAns.answer === cIdx;
          s.userAnswers[i].isCorrect = isCorrect;
          if (isCorrect) {
            score += 2;
            correct++;
          } else {
            score -= 0.66;
            incorrect++;
          }
        } else {
          unattempted++;
        }
      });

      const finalScore = parseFloat(score.toFixed(2));
      const totalMarks = totalQ * 2;
      const percentage =
        totalMarks > 0 ? ((finalScore / totalMarks) * 100).toFixed(1) : 0;

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
        totalMarks: totalMarks,
        scorePercent: parseFloat(percentage),
        userAnswers: s.userAnswers,
        questionTimeSpent: s.questionTimeSpent, // Save time per question
        timestamp: now,
      };

      s.submittedResult = {
        correct,
        incorrect,
        unattempted,
        finalScore,
        totalMarks,
        percentage,
        resultObject,
      };
      s.statsLine = null;
      forceUpdate();

      if (currentUser) {
        db.collection("results")
          .add({ ...resultObject })
          .then(async (docRef) => {
            leaderboardEntry.resultId = docRef.id;
            g.userHistory.unshift({ ...resultObject, timestamp: now });
            if (g.userHistory.length > 20) g.userHistory.pop();
            g.dashboardDataLoaded = true;
            bumpHistory();

            // Invalidate caches
            await DataManager.invalidateCache(
              `global_stats_${s.currentChapterId}`
            );
            await DataManager.invalidateCache(
              `user_history_${currentUser.uid}`
            );

            if (!s.currentChapterId.startsWith("revision_")) {
              const statsRef = db
                .collection("chapter_stats")
                .doc(s.currentChapterId);
              try {
                await db.runTransaction(async (transaction) => {
                  const sfDoc = await transaction.get(statsRef);
                  const newScore = parseFloat(percentage);

                  if (!sfDoc.exists) {
                    const initCorrectCounts = s.currentQuizData.map((q, i) =>
                      s.userAnswers[i] &&
                      s.userAnswers[i].answer === getCorrectIndex(q)
                        ? 1
                        : 0
                    );
                    const initAttemptedCounts = s.currentQuizData.map((q, i) =>
                      s.userAnswers[i] ? 1 : 0
                    );
                    transaction.set(statsRef, {
                      totalScore: newScore,
                      totalAttempts: 1,
                      average: newScore,
                      highestScore: newScore,
                      allScores: [newScore],
                      leaderboard: [leaderboardEntry],
                      correctCounts: initCorrectCounts,
                      attemptedCounts: initAttemptedCounts,
                    });
                  } else {
                    const data = sfDoc.data();
                    const newAttempts = (data.totalAttempts || 0) + 1;
                    const newAvg =
                      ((data.totalScore || 0) + newScore) / newAttempts;
                    let currentLeaderboard = data.leaderboard || [];
                    currentLeaderboard.push(leaderboardEntry);
                    currentLeaderboard.sort(
                      (a, b) => b.scorePercent - a.scorePercent
                    );
                    if (currentLeaderboard.length > 10)
                      currentLeaderboard = currentLeaderboard.slice(0, 10);

                    let cCounts = [...(data.correctCounts || [])];
                    let aCounts = [...(data.attemptedCounts || [])];

                    // Densify arrays: Ensure no holes and extend to current length
                    const maxLen = Math.max(
                      cCounts.length,
                      aCounts.length,
                      s.currentQuizData.length
                    );
                    for (let j = 0; j < maxLen; j++) {
                      if (cCounts[j] == null) cCounts[j] = 0;
                      if (aCounts[j] == null) aCounts[j] = 0;
                    }

                    s.currentQuizData.forEach((q, i) => {
                      if (s.userAnswers[i]) {
                        aCounts[i] = (aCounts[i] || 0) + 1;
                        if (s.userAnswers[i].answer === getCorrectIndex(q))
                          cCounts[i] = (cCounts[i] || 0) + 1;
                      }
                    });

                    transaction.update(statsRef, {
                      totalScore: (data.totalScore || 0) + newScore,
                      totalAttempts: newAttempts,
                      average: newAvg,
                      highestScore: Math.max(data.highestScore || 0, newScore),
                      allScores: [...(data.allScores || []), newScore],
                      leaderboard: currentLeaderboard,
                      correctCounts: cCounts,
                      attemptedCounts: aCounts,
                    });
                  }
                });
                toastr.success("Result and stats saved!");
              } catch (e) {
                console.error("Stats update failed:", e);
              }
            } else {
              toastr.success("Revision test result saved!");
            }

            const stats = await DataManager.fetchGlobalStats(
              s.currentChapterId,
              true
            );
            if (stats) {
              let betterThan = 0;
              const pct = parseFloat(percentage);
              const allScoresLen = stats.allScores.length;
              for (let k = 0; k < allScoresLen; k++) {
                if (stats.allScores[k] < pct) {
                  betterThan++;
                }
              }
              const percentile =
                stats.totalAttempts > 0
                  ? ((betterThan / stats.totalAttempts) * 100).toFixed(0)
                  : 0;
              s.statsLine = `🌍 Performance: Top <strong>${
                100 - percentile
              }%</strong>. (Avg: ${stats.avg.toFixed(1)}%)`;
              forceUpdate();
            }
          });
      }
    },
    [s, currentUser, g, updateQuestionTimer, clearQuizProgress, bumpHistory]
  );
  submitAllRef.current = submitAll;

  /* ---------- Review right after submit ---------- */
  const reviewAfterSubmit = () => {
    const subjectPrefix = s.currentSubject.replace(/\s+/g, "_") + "_";
    const originalChapId = s.currentChapterId.replace(subjectPrefix, "");
    loadQuiz(
      s.currentSubject,
      originalChapId,
      encodeURIComponent(s.currentChapterName),
      true,
      s.submittedResult.resultObject,
      "chapters"
    );
  };

  /* =========================================
     RENDER
     ========================================= */
  if (phase === "loading") {
    return (
      <section className="quiz-section py-5">
        <div className="container">
          <div className="d-flex justify-content-between mb-4">
            <button className="btn btn-primary-custom px-4 shadow" onClick={exitQuiz}>
              ← Exit
            </button>
          </div>
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="mt-2 text-muted">Loading Questions...</p>
          </div>
        </div>
      </section>
    );
  }

  if (phase === "startModal") {
    return (
      <section className="quiz-section py-5">
        <div className="container">
          <div className="d-flex justify-content-between mb-4">
            <button className="btn btn-primary-custom px-4 shadow" onClick={exitQuiz}>
              ← Exit
            </button>
          </div>
        </div>
        <StartQuizModal
          subject={s.currentSubject}
          chapter={s.currentChapterName}
          numQuestions={s.currentQuizData.length}
          savedTime={savedTimeRef.current}
          onStart={startQuizExecution}
          onCancel={() => showChapters(s.currentSubject)}
        />
      </section>
    );
  }

  if (phase === "review") {
    return (
      <section className="quiz-section py-5">
        <div className="container">
          <div className="d-flex justify-content-between mb-4">
            <button className="btn btn-primary-custom px-4 shadow" onClick={exitQuiz}>
              ← Exit
            </button>
          </div>
          <div className="row">
            <div className="col-12">
              <div className="quiz-box h-100">
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
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* ---------- Active quiz ---------- */
  const question = s.currentQuizData[s.currentQuestionIndex];
  const correctIndex = getCorrectIndex(question);
  const uAnsCurrent = s.userAnswers[s.currentQuestionIndex];
  const currentSurety = uAnsCurrent?.surety;
  const isMarked = !!s.markedForReview[s.currentQuestionIndex];

  return (
    <section className="quiz-section py-5">
      <div className="container">
        <div className="d-flex justify-content-between mb-4">
          <button id="quiz-back-btn" className="btn btn-primary-custom px-4 shadow" onClick={exitQuiz}>
            ← Exit
          </button>
        </div>
        <div className="row">
          <div className="col-lg-8 mb-4">
            <div className="quiz-box h-100" id="quiz-content">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="fw-bold text-primary m-0">{s.currentChapterName}</h4>
                <button
                  id="mark-review-btn"
                  className={`btn btn-sm fw-bold shadow-sm ${
                    isMarked ? "btn-primary-custom" : "btn-secondary-custom"
                  }`}
                  onClick={toggleMarkForReview}
                >
                  {isMarked ? (
                    <>
                      <i className="bi bi-bookmark-check-fill"></i> Unmark Review
                    </>
                  ) : (
                    <>
                      <i className="bi bi-bookmark-star"></i> Mark for Review
                    </>
                  )}
                </button>
              </div>

              <div
                id="question-container"
                style={
                  s.isTimerPaused
                    ? { filter: "blur(8px)", pointerEvents: "none" }
                    : { filter: "none", pointerEvents: "all" }
                }
              >
                <div className="question">
                  <div className="mb-3 lead fw-bold">
                    Q{s.currentQuestionIndex + 1}.{" "}
                    <span
                      dangerouslySetInnerHTML={{
                        __html: TextFormatter.formatQuestionText(question.text),
                      }}
                    />
                  </div>

                  {question.options.map((opt, idx) => {
                    const isSelected = uAnsCurrent && uAnsCurrent.answer === idx;
                    let labelClass = "option shadow-sm";
                    if (s.quizSubmitted) {
                      if (idx === correctIndex) labelClass += " correct-answer-label";
                      if (isSelected && idx !== correctIndex)
                        labelClass += " incorrect-answer-label";
                    }
                    return (
                      <label className={labelClass} key={idx}>
                        <input
                          type="radio"
                          name={`q${s.currentQuestionIndex}`}
                          value={idx}
                          checked={!!isSelected}
                          disabled={s.quizSubmitted}
                          onChange={() => {
                            if (!s.quizSubmitted) selectAnswer(idx);
                          }}
                        />{" "}
                        <span dangerouslySetInnerHTML={{ __html: opt }} />
                      </label>
                    );
                  })}

                  {/* --- SURETY MATRIX --- */}
                  <div className="mt-4 mb-3 animate-fade-in">
                    <div className="surety-label">Confidence Level</div>
                    <div className="surety-matrix shadow-sm" role="radiogroup" aria-label="Confidence Level">
                      {[100, 75, 50, 0].map((val) => (
                        <div
                          key={val}
                          className={`surety-opt surety-${val} ${
                            currentSurety === val ? "selected" : ""
                          }`}
                          data-val={val}
                          role="radio"
                          tabIndex={0}
                          aria-checked={currentSurety === val}
                          aria-label={`${val}% Confidence`}
                          onClick={() => {
                            if (!s.quizSubmitted) selectSurety(val);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              if (!s.quizSubmitted) selectSurety(val);
                            }
                          }}
                        >
                          {val}%
                        </div>
                      ))}
                    </div>
                  </div>

                  {s.quizSubmitted && question.explanation && (
                    <div className="explanation shadow-sm mt-3">
                      <strong>💡 Explanation:</strong> <br />
                      <span dangerouslySetInnerHTML={{ __html: question.explanation }} />
                    </div>
                  )}
                </div>
              </div>

              <div className="d-flex justify-content-between mt-4">
                <button
                  id="prev-btn"
                  className="btn btn-secondary-custom px-4"
                  disabled={s.currentQuestionIndex === 0}
                  onClick={() => navigateQuestions(-1)}
                >
                  Previous
                </button>
                <button
                  id="clear-btn"
                  className="btn btn-primary-custom px-4"
                  disabled={s.quizSubmitted}
                  onClick={clearSelection}
                >
                  Clear
                </button>
                <button
                  id="next-btn"
                  className="btn btn-secondary-custom px-4"
                  disabled={s.currentQuestionIndex === s.currentQuizData.length - 1}
                  onClick={() => navigateQuestions(1)}
                >
                  Next
                </button>
              </div>

              {/* Feedback after submit (showFeedbackText) */}
              <div id="question-feedback" className="mt-3 text-center">
                {s.quizSubmitted &&
                  (uAnsCurrent && uAnsCurrent.answer === correctIndex ? (
                    <h5 className="text-success fw-bold">Correct! 🎉</h5>
                  ) : uAnsCurrent ? (
                    <h5 className="text-danger fw-bold">Incorrect. ❌</h5>
                  ) : (
                    <h5 className="text-secondary fw-bold">Unattempted. ⚪</h5>
                  ))}
              </div>

              {/* Result panel */}
              <div id="result" className="mt-4 text-center">
                {s.submittedResult && (
                  <>
                    <div className="alert alert-primary mt-3 shadow-sm" role="alert">
                      <h4 className="alert-heading fw-bold">Test Complete! 🏆</h4>
                      <hr />
                      <p>
                        ✅ Correct: <strong>{s.submittedResult.correct}</strong> | ❌
                        Incorrect: <strong>{s.submittedResult.incorrect}</strong>
                      </p>
                      <p>
                        ⚪ Unattempted:{" "}
                        <strong>{s.submittedResult.unattempted}</strong>
                      </p>
                      <h3 className="text-primary mt-2">
                        Score: {s.submittedResult.finalScore} /{" "}
                        {s.submittedResult.totalMarks} (
                        {s.submittedResult.percentage}%)
                      </h3>
                      <div id="stats-loading" className="mt-2 text-muted small">
                        {s.statsLine ? (
                          <span dangerouslySetInnerHTML={{ __html: s.statsLine }} />
                        ) : (
                          <>
                            <span className="spinner-border spinner-border-sm"></span>{" "}
                            Calculating class standing...
                          </>
                        )}
                      </div>
                    </div>
                    <div id="result-actions" className="d-flex justify-content-center gap-2 mt-2">
                      <button className="btn btn-primary-custom px-4 shadow" onClick={reviewAfterSubmit}>
                        👁 Review Performance
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Question Palette Sidebar */}
          <div className="col-lg-4">
            <div id="quiz-nav" className="quiz-nav-sidebar">
              <div className="nav-header">Question Palette</div>
              <div
                className="timer-container shadow-sm position-relative"
                style={{ paddingBottom: 45 }}
              >
                <span className="timer-label">Time Remaining</span>
                <div
                  id="timer-display"
                  className={`timer-value ${timerDisplay.low ? "low-time" : ""}`}
                >
                  {timerDisplay.text || "00:00"}
                </div>
                <button
                  id="timer-pause-btn"
                  className={`btn btn-sm fw-bold position-absolute ${
                    s.isTimerPaused ? "btn-primary-custom" : "btn-secondary-custom"
                  }`}
                  style={{
                    bottom: 12,
                    right: 12,
                    fontSize: "0.85rem",
                    padding: "5px 12px",
                    borderRadius: 8,
                  }}
                  onClick={toggleTimer}
                >
                  {s.isTimerPaused ? (
                    <>
                      <i className="bi bi-play-fill"></i> Resume
                    </>
                  ) : (
                    <>
                      <i className="bi bi-pause-fill"></i> Pause
                    </>
                  )}
                </button>
              </div>
              <div id="nav-container" className="nav-grid">
                {s.currentQuizData.map((_, i) => {
                  let cls = "nav-item shadow-sm nav-item-animate";
                  if (i === s.currentQuestionIndex) cls += " active";
                  const uAns = s.userAnswers[i];
                  const marked = s.markedForReview[i];
                  if (s.quizSubmitted) {
                    const cIdx = getCorrectIndex(s.currentQuizData[i]);
                    if (!uAns) cls += " unattempted";
                    else if (uAns.answer === cIdx) cls += " correct-nav";
                    else cls += " incorrect-nav";
                  } else {
                    if (uAns) cls += " attempted";
                    if (marked) cls += " marked-nav";
                  }
                  return (
                    <div
                      key={i}
                      className={cls}
                      style={{ "--animation-delay": `${i * 30}ms` }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Question ${i + 1}`}
                      onClick={() => gotoQuestion(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          gotoQuestion(i);
                        }
                      }}
                    >
                      {i + 1}
                    </div>
                  );
                })}
              </div>
              {!s.quizSubmitted && (
                <button
                  id="final-submit-btn"
                  className="btn btn-success-custom w-100 mt-4 py-2 fw-bold"
                  onClick={() => submitAll(false)}
                >
                  Submit Test
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
