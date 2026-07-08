/* =========================================
   TEST RUNNER (ported from quiz.js)
   ========================================= */
import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { db } from "../lib/firebase";
import { useApp } from "../store";
import { DataManager } from "../lib/dataManager";
import { QuizTimer } from "../lib/timer";
import { getCorrectIndex, TextFormatter } from "../lib/helpers";
import { toastr } from "../lib/toastr";
import ReviewMode from "./ReviewMode";

export default function QuizFlow() {
  const {
    g,
    currentUser,
    viewParams,
    showDashboard,
    showChapters,
    bumpHistory,
  } = useApp();

  const [phase, setPhase] = useState("loading");
  const [timerDisplay, setTimerDisplay] = useState({ text: "00:00", low: false });
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
    isTimerPaused: false,
    statsLine: null,
  }).current;

  const timerRef = useRef(null);
  const questionStartTimeRef = useRef(Date.now());
  const savedTimeRef = useRef(null);
  const submitAllRef = useRef(() => {});

  const updateQuestionTimer = useCallback(() => {
    if (s.isTimerPaused || s.quizSubmitted) return;
    const now = Date.now();
    const spent = Math.floor((now - questionStartTimeRef.current) / 1000);
    s.questionTimeSpent[s.currentQuestionIndex] =
      (s.questionTimeSpent[s.currentQuestionIndex] || 0) + spent;
    questionStartTimeRef.current = now;
  }, [s]);

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
    if (s.isTimerPaused) {
      if (timerRef.current) timerRef.current.resume();
      s.isTimerPaused = false;
      questionStartTimeRef.current = Date.now();
      toastr.success("Timer Resumed");
    } else {
      updateQuestionTimer();
      if (timerRef.current) timerRef.current.pause();
      s.isTimerPaused = true;
      toastr.warning("Timer Paused. Options disabled.");
    }
    forceUpdate();
  };

  const startQuizExecution = (resumedTimeLeft) => {
    setPhase("active");
    questionStartTimeRef.current = Date.now();

    const limit = s.currentQuizData.length * 1.5 * 60;
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
      s.currentSubject = subj;
      s.currentChapterId = chapId;
      s.currentChapterName = chapName;
      s.userAnswers = {};
      s.markedForReview = {};
      s.questionTimeSpent = {};
      s.currentQuestionIndex = 0;
      s.quizSubmitted = false;
      s.submittedResult = null;
      s.isTimerPaused = false;

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
        const savedProgStr =
          DataManager.cache[progKey] || localStorage.getItem(progKey);

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
    if (s.isTimerPaused) return;
    updateQuestionTimer();
    s.currentQuestionIndex = idx;
    questionStartTimeRef.current = Date.now();
    forceUpdate();
  };

  const navigateQuestions = (step) => {
    if (s.isTimerPaused) return;
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
      if (!forceSubmit && !window.confirm("Are you sure you want to submit?"))
        return;

      if (timerRef.current) timerRef.current.stop();
      updateQuestionTimer();

      s.quizSubmitted = true;
      clearQuizProgress(s.currentChapterId);

      let score = 0;
      let correct = 0, incorrect = 0, unattempted = 0;
      const totalQ = s.currentQuizData.length;

      s.currentQuizData.forEach((q, i) => {
        const uAns = s.userAnswers[i];
        const cIdx = getCorrectIndex(q);

        if (uAns) {
          const isCorrect = uAns.answer === cIdx;
          s.userAnswers[i].isCorrect = isCorrect;
          if (isCorrect) { score += 2; correct++; }
          else { score -= 0.66; incorrect++; }
        } else {
          unattempted++;
        }
      });

      const finalScore = parseFloat(score.toFixed(2));
      const totalMarks = totalQ * 2;
      const percentage = totalMarks > 0 ? ((finalScore / totalMarks) * 100).toFixed(1) : 0;
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
        questionTimeSpent: s.questionTimeSpent,
        timestamp: now,
      };

      s.submittedResult = {
        correct, incorrect, unattempted, finalScore, totalMarks, percentage, resultObject,
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

            await DataManager.invalidateCache(`global_stats_${s.currentChapterId}`);
            await DataManager.invalidateCache(`user_history_${currentUser.uid}`);

            if (!s.currentChapterId.startsWith("revision_")) {
              const statsRef = db.collection("chapter_stats").doc(s.currentChapterId);
              try {
                await db.runTransaction(async (transaction) => {
                  const sfDoc = await transaction.get(statsRef);
                  const newScore = parseFloat(percentage);

                  if (!sfDoc.exists) {
                    const initCorrectCounts = s.currentQuizData.map((q, i) =>
                      s.userAnswers[i] && s.userAnswers[i].answer === getCorrectIndex(q) ? 1 : 0
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
                    const newAvg = ((data.totalScore || 0) + newScore) / newAttempts;
                    let currentLeaderboard = data.leaderboard || [];
                    currentLeaderboard.push(leaderboardEntry);
                    currentLeaderboard.sort((a, b) => b.scorePercent - a.scorePercent);
                    if (currentLeaderboard.length > 10) currentLeaderboard = currentLeaderboard.slice(0, 10);

                    let cCounts = [...(data.correctCounts || [])];
                    let aCounts = [...(data.attemptedCounts || [])];
                    const maxLen = Math.max(cCounts.length, aCounts.length, s.currentQuizData.length);
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

            const stats = await DataManager.fetchGlobalStats(s.currentChapterId, true);
            if (stats) {
              let betterThan = 0;
              const pct = parseFloat(percentage);
              for (let k = 0; k < stats.allScores.length; k++) {
                if (stats.allScores[k] < pct) betterThan++;
              }
              const percentile = stats.totalAttempts > 0 ? ((betterThan / stats.totalAttempts) * 100).toFixed(0) : 0;
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

  /* =========================================
     RENDER
     ========================================= */
  if (phase === "loading") {
    return (
      <div className="page empty">
        <div className="spinner"></div>
        <p style={{ marginTop: 14 }}>Loading Questions...</p>
      </div>
    );
  }

  if (phase === "startModal") {
    return (
      <div className="modal-backdrop">
        <div className="modal">
          <h3 className="modal__title">Ready to Start?</h3>
          <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>
            {s.currentSubject} &rsaquo; {s.currentChapterName}
          </p>
          <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
            <div className="stat">
              <span className="eyebrow">Questions</span>
              <span className="stat__value">{s.currentQuizData.length}</span>
            </div>
            {savedTimeRef.current !== null && (
              <div className="stat stat--pen">
                <span className="eyebrow">Status</span>
                <span className="stat__value" style={{ fontSize: 18 }}>In Progress</span>
                <span className="stat__sub">Resuming from previous state</span>
              </div>
            )}
          </div>
          <div className="modal__actions">
            <button className="btn btn--ghost" onClick={() => showChapters(s.currentSubject)}>Cancel</button>
            <button className="btn btn--primary" onClick={() => startQuizExecution(savedTimeRef.current)}>
              {savedTimeRef.current !== null ? "Resume Test" : "Start Test"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "review") {
    return (
      <div className="page" style={{ maxWidth: 1200 }}>
        <div style={{ marginBottom: 16 }}>
          <button className="btn btn--ghost" onClick={exitQuiz}>← Back</button>
        </div>
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

  const question = s.currentQuizData[s.currentQuestionIndex];
  const correctIndex = getCorrectIndex(question);
  const uAnsCurrent = s.userAnswers[s.currentQuestionIndex];
  const currentSurety = uAnsCurrent?.surety;
  const isMarked = !!s.markedForReview[s.currentQuestionIndex];

  return (
    <div className="runner">
      <div className="runner__bar">
        <button className="btn btn--ghost" onClick={exitQuiz}>← Exit</button>
        <h4 style={{ margin: 0, color: "var(--ink-soft)" }}>{s.currentChapterName}</h4>
        <div className={`timer-pill ${timerDisplay.low ? "timer-pill--low" : ""}`}>
          ⏳ {timerDisplay.text || "00:00"}
        </div>
      </div>

      <div className="runner__grid">
        <div className="card" style={{ padding: "24px 28px" }}>
          <div className="card__head">
            <h2 className="card__title">Question {s.currentQuestionIndex + 1}</h2>
            <button
              className={`btn btn--sm ${isMarked ? "btn--subtle" : "btn--ghost"}`}
              onClick={toggleMarkForReview}
            >
              {isMarked ? "★ Unmark" : "☆ Mark for Review"}
            </button>
          </div>

          <div
            style={s.isTimerPaused ? { filter: "blur(8px)", pointerEvents: "none" } : { filter: "none" }}
          >
            <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 24, lineHeight: 1.6 }}>
              <span dangerouslySetInnerHTML={{ __html: TextFormatter.formatQuestionText(question.text || question.question) }} />
            </div>

            <div className="grid">
              {question.options.map((opt, idx) => {
                const isSelected = uAnsCurrent && uAnsCurrent.answer === idx;
                let optionClass = "option";
                let omrClass = "omr";

                if (s.quizSubmitted) {
                  if (idx === correctIndex) {
                    optionClass += " option--correct";
                    omrClass += " omr--correct";
                  } else if (isSelected && idx !== correctIndex) {
                    optionClass += " option--wrong";
                    omrClass += " omr--wrong";
                  }
                } else if (isSelected) {
                  optionClass += " option--selected";
                  omrClass += " omr--filled";
                }

                const labelMap = ["A", "B", "C", "D"];

                return (
                  <button
                    key={idx}
                    className={optionClass}
                    disabled={s.quizSubmitted}
                    onClick={() => { if (!s.quizSubmitted) selectAnswer(idx); }}
                  >
                    <div className={omrClass}>{labelMap[idx]}</div>
                    <div className="option__text" dangerouslySetInnerHTML={{ __html: opt }} />
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 24 }}>
              <span className="eyebrow" style={{ display: "block", marginBottom: 8 }}>Confidence Level</span>
              <div className="confidence">
                {[100, 75, 50, 0].map((val) => (
                  <button
                    key={val}
                    className={`confidence__chip ${currentSurety === val ? "confidence__chip--on" : ""}`}
                    disabled={s.quizSubmitted}
                    onClick={() => { if (!s.quizSubmitted) selectSurety(val); }}
                  >
                    {val}% Confidence
                  </button>
                ))}
              </div>
            </div>

            {s.quizSubmitted && question.explanation && (
              <div className="explanation" style={{ marginTop: 24 }}>
                <strong style={{ display: "block", marginBottom: 4 }}>💡 Explanation:</strong>
                <span dangerouslySetInnerHTML={{ __html: question.explanation }} />
              </div>
            )}
          </div>

          <div className="runner__nav">
            <button
              className="btn btn--ghost"
              disabled={s.currentQuestionIndex === 0}
              onClick={() => navigateQuestions(-1)}
            >
              Previous
            </button>
            <button
              className="btn btn--ghost"
              disabled={s.quizSubmitted}
              onClick={clearSelection}
            >
              Clear
            </button>
            <button
              className="btn btn--ghost"
              disabled={s.currentQuestionIndex === s.currentQuizData.length - 1}
              onClick={() => navigateQuestions(1)}
            >
              Next
            </button>
          </div>

          {s.submittedResult && (
            <div style={{ marginTop: 30, borderTop: "1px dashed var(--line)", paddingTop: 30 }}>
              <div className="score-strip">
                <div className="score-strip__big">Score: {s.submittedResult.finalScore}</div>
                <div>
                  <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>Total Marks</div>
                  <div style={{ fontWeight: 600 }}>{s.submittedResult.totalMarks}</div>
                </div>
                <div>
                  <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>Accuracy</div>
                  <div style={{ fontWeight: 600 }}>{s.submittedResult.percentage}%</div>
                </div>
              </div>

              <div className="stats-grid">
                <Stat variant="leaf" label="Correct" value={s.submittedResult.correct} />
                <Stat variant="stamp" label="Incorrect" value={s.submittedResult.incorrect} />
                <Stat label="Unattempted" value={s.submittedResult.unattempted} />
              </div>
              
              <div style={{ marginTop: 16, color: "var(--ink-soft)", fontSize: 13 }}>
                {s.statsLine ? (
                  <span dangerouslySetInnerHTML={{ __html: s.statsLine }} />
                ) : (
                  "Calculating class standing..."
                )}
              </div>

              <button className="btn btn--primary btn--block" style={{ marginTop: 20 }} onClick={reviewAfterSubmit}>
                👁 Review Performance Details
              </button>
            </div>
          )}
        </div>

        <div className="sidebar">
          <div className="card" style={{ padding: "16px 14px" }}>
            <div className="card__head">
              <span className="eyebrow">Question Palette</span>
            </div>
            
            <div className="palette">
              {s.currentQuizData.map((_, i) => {
                let cls = "palette__cell";
                if (i === s.currentQuestionIndex) cls += " palette__cell--current";
                
                const uAns = s.userAnswers[i];
                const marked = s.markedForReview[i];
                
                if (s.quizSubmitted) {
                  const cIdx = getCorrectIndex(s.currentQuizData[i]);
                  if (!uAns) cls += " palette__cell--unanswered";
                  else if (uAns.answer === cIdx) cls += " palette__cell--correct";
                  else cls += " palette__cell--wrong";
                } else {
                  if (uAns) cls += " palette__cell--answered";
                  else if (marked) cls += " palette__cell--marked";
                }

                return (
                  <button
                    key={i}
                    className={cls}
                    onClick={() => gotoQuestion(i)}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            {!s.quizSubmitted && (
              <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                <button className="btn btn--ghost btn--block" onClick={toggleTimer}>
                  {s.isTimerPaused ? "▶ Resume Timer" : "⏸ Pause Timer"}
                </button>
                <button className="btn btn--success btn--block" onClick={() => submitAll(false)}>
                  Submit Test
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
