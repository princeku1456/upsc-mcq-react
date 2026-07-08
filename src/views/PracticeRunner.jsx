/* =========================================
   PRACTICE RUNNER (ported from practice.js:
   loadPracticeQuiz body, setupPracticeLayout, renderPracticeQuestion,
   nav, submitPractice, togglePracticeMarkForReview)
   Scoring (+2 / -0.66), Fisher-Yates partial shuffle, practiceResult
   write with serverTimestamp, cache invalidation, purple mark styles.
   ========================================= */
import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import firebase, { db, getDb } from "../lib/firebase";
import { useApp } from "../store";
import { DataManager } from "../lib/dataManager";
import { QuizTimer } from "../lib/timer";
import { getCorrectIndex, TextFormatter } from "../lib/helpers";
import { toastr } from "../lib/toastr";

export default function PracticeRunner() {
  const {
    g,
    currentUser,
    viewParams,
    showHome,
    showDashboard,
    startPracticeSelection,
    bumpHistory,
  } = useApp();

  const p = useRef({
    practiceSubject: "",
    practiceChapter: "",
    practiceQuestionLimit: 0,
    practiceSubmitted: false,
    practiceMarkedForReview: {},
    practiceUserAnswers: {},
    practiceCurrentIndex: 0,
    practiceQuizData: [],
    resultSummary: null, // computed summary object post-submit
  }).current;

  const timerRef = useRef(null);
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  const [phase, setPhase] = useState("loading"); // loading | active | error
  const [timerDisplay, setTimerDisplay] = useState({ text: "00:00", low: false });
  const submitRef = useRef(() => {});

  /* ---------- startPracticeTimer (verbatim, 1.2 min/q) ---------- */
  const startPracticeTimer = useCallback((limit) => {
    if (timerRef.current) timerRef.current.stop();
    const timeLeft = Math.floor(limit * 1.2 * 60);
    timerRef.current = new QuizTimer(
      (text, low) => setTimerDisplay({ text, low }),
      null,
      () => {
        toastr.warning("Time's up! Finishing practice session...");
        submitRef.current(true);
      }
    );
    timerRef.current.start(timeLeft);
  }, []);

  /* ---------- loadPracticeQuiz body ---------- */
  useEffect(() => {
    g.isPracticeMode = true;
    let cancelled = false;

    async function run() {
      const subject = viewParams.subject;
      const chapter = viewParams.chapter;
      const limit = viewParams.limit;

      p.practiceSubject = subject;
      p.practiceChapter = chapter === "all" ? "All Topics" : chapter;
      p.practiceQuestionLimit = limit;
      p.practiceSubmitted = false;
      p.practiceMarkedForReview = {};

      try {
        const allPracticeData =
          DataManager.cache.practiceManifest || window.allPracticeData || {};
        const chapterIds =
          chapter === "all"
            ? Object.keys(allPracticeData[subject] || {})
            : [chapter];

        const promises = chapterIds.map((chapId) => {
          const docId = subject.replace(/\s+/g, "_") + "_" + chapId;
          return DataManager.fetchPracticeQuestions(docId);
        });

        const results = await Promise.all(promises);
        const allQuestions = results.flat();
        if (cancelled) return;

        if (allQuestions.length === 0) {
          toastr.error("No questions available.");
          setPhase("error");
          return;
        }

        const randomized = [...allQuestions];
        const fetchLimit = Math.min(limit, randomized.length);
        for (let i = 0; i < fetchLimit; i++) {
          const j = i + Math.floor(Math.random() * (randomized.length - i));
          const temp = randomized[i];
          randomized[i] = randomized[j];
          randomized[j] = temp;
        }
        p.practiceQuizData = randomized.slice(0, fetchLimit);
        p.practiceCurrentIndex = 0;
        p.practiceUserAnswers = {};

        setPhase("active");
        startPracticeTimer(limit);
        forceUpdate();
      } catch (error) {
        console.error("Fetch Error:", error);
        toastr.error("Failed to load questions.");
        if (!cancelled) setPhase("error");
      }
    }

    run();
    return () => {
      cancelled = true;
      if (timerRef.current) timerRef.current.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Navigation (verbatim) ---------- */
  const navPractice = (dir) => {
    const next = p.practiceCurrentIndex + dir;
    if (next >= 0 && next < p.practiceQuizData.length) {
      p.practiceCurrentIndex = next;
      forceUpdate();
    }
  };

  const jumpTo = (i) => {
    p.practiceCurrentIndex = i;
    forceUpdate();
  };

  const clearPracticeSelection = () => {
    if (p.practiceSubmitted) return;
    delete p.practiceUserAnswers[p.practiceCurrentIndex];
    forceUpdate();
  };

  const selectAnswer = (idx) => {
    if (p.practiceSubmitted) return;
    if (!p.practiceUserAnswers[p.practiceCurrentIndex])
      p.practiceUserAnswers[p.practiceCurrentIndex] = {};
    p.practiceUserAnswers[p.practiceCurrentIndex].answer = idx;
    forceUpdate();
  };

  const selectSurety = (val) => {
    if (p.practiceSubmitted) return;
    if (!p.practiceUserAnswers[p.practiceCurrentIndex])
      p.practiceUserAnswers[p.practiceCurrentIndex] = { answer: -1 };
    p.practiceUserAnswers[p.practiceCurrentIndex].surety = val;
    forceUpdate();
  };

  const togglePracticeMarkForReview = () => {
    if (p.practiceSubmitted) return;
    if (p.practiceMarkedForReview[p.practiceCurrentIndex]) {
      delete p.practiceMarkedForReview[p.practiceCurrentIndex];
      toastr.info("Removed from Review");
    } else {
      p.practiceMarkedForReview[p.practiceCurrentIndex] = true;
      toastr.success("Marked for Review");
    }
    forceUpdate();
  };

  /* ---------- submitPractice (verbatim scoring + Firestore) ---------- */
  const submitPractice = useCallback(
    (forceSubmit = false) => {
      if (!forceSubmit && !window.confirm("Finish this practice session?")) return;

      if (timerRef.current) timerRef.current.stop();
      p.practiceSubmitted = true;

      let score = 0;
      let correct = 0,
        incorrect = 0,
        unattempted = 0;

      p.practiceQuizData.forEach((q, i) => {
        const uAns = p.practiceUserAnswers[i];
        const cIdx = getCorrectIndex(q);
        if (uAns && uAns.answer !== undefined && uAns.answer !== -1) {
          const isCorrect = uAns.answer === cIdx;
          p.practiceUserAnswers[i].isCorrect = isCorrect;
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

      const totalQuestions = p.practiceQuizData.length;
      const totalPossibleMarks = totalQuestions * 2;
      const accuracy = ((correct / (correct + incorrect)) * 100 || 0).toFixed(1);
      const negativeLoss = incorrect * 0.66;
      const positiveGain = correct * 2;
      const negativeDrain = positiveGain
        ? ((negativeLoss / positiveGain) * 100).toFixed(1)
        : 0;

      if (currentUser) {
        const resultData = {
          userId: currentUser.uid,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          subject: p.practiceSubject,
          chapterName: p.practiceChapter,
          chapterId: "practice_session",
          scorePercent: parseFloat(accuracy),
          totalMarks: totalPossibleMarks,
          userAnswers: p.practiceUserAnswers,
          correctCount: correct,
          incorrectCount: incorrect,
          unattemptedCount: unattempted,
        };

        getDb()
          .collection("practiceResult")
          .add(resultData)
          .then(async (docRef) => {
            toastr.success("Practice result saved!");
            g.practiceHistory.unshift({
              id: docRef.id,
              ...resultData,
              timestamp: new Date(),
            });
            bumpHistory();
            await DataManager.invalidateCache(
              `user_practice_history_${currentUser.uid}`
            );
          })
          .catch((error) => {
            console.error("Error saving practice result:", error);
            toastr.error("Failed to save result.");
          });
      }

      p.resultSummary = {
        score,
        totalPossibleMarks,
        accuracy,
        negativeDrain,
        correct,
        incorrect,
        unattempted,
      };
      forceUpdate();
    },
    [currentUser, g, bumpHistory, p]
  );
  submitRef.current = submitPractice;

  /* ---------- exitQuiz for practice → startPracticeSelection ---------- */
  const exitQuiz = () => {
    if (timerRef.current) timerRef.current.stop();
    startPracticeSelection();
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
            <div className="spinner-border text-info" role="status"></div>
            <p className="mt-2 text-muted">Optimizing your session...</p>
          </div>
        </div>
      </section>
    );
  }

  if (phase === "error") {
    return (
      <section className="quiz-section py-5">
        <div className="container">
          <div className="d-flex justify-content-between mb-4">
            <button className="btn btn-primary-custom px-4 shadow" onClick={exitQuiz}>
              ← Exit
            </button>
          </div>
          <div className="alert alert-warning text-center">
            No questions available for this selection.
          </div>
        </div>
      </section>
    );
  }

  const q = p.practiceQuizData[p.practiceCurrentIndex];
  const cIdx = getCorrectIndex(q);
  const currentAnswer = p.practiceUserAnswers[p.practiceCurrentIndex];
  const currentSurety = currentAnswer?.surety;
  const isMarked = p.practiceMarkedForReview[p.practiceCurrentIndex];
  const submitted = p.practiceSubmitted;

  return (
    <section className="quiz-section py-5">
      <div className="container">
        <div className="d-flex justify-content-between mb-4">
          <button className="btn btn-primary-custom px-4 shadow" onClick={exitQuiz}>
            ← Exit
          </button>
        </div>
        <div className="row">
          {/* Main content */}
          <div className="col-lg-8 mb-4">
            <div className="quiz-box h-100">
              <div id="quiz-content">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h4 className="fw-bold text-info m-0">{p.practiceChapter}</h4>
                  {!submitted && (
                    <button
                      className="btn btn-outline-secondary btn-sm fw-bold shadow-sm"
                      style={{
                        backgroundColor: isMarked ? "#7e22ce" : "transparent",
                        color: isMarked ? "#ffffff" : "#7e22ce",
                      }}
                      onClick={togglePracticeMarkForReview}
                    >
                      <i className={`bi ${isMarked ? "bi-bookmark-fill" : "bi-bookmark"}`}></i>{" "}
                      {isMarked ? "Unmark Review" : "Mark for Review"}
                    </button>
                  )}
                </div>

                {/* Result summary */}
                {p.resultSummary && (
                  <div className="mb-4">
                    <PracticeResultCard summary={p.resultSummary} />
                  </div>
                )}

                {/* Question */}
                <div id="practice-question-container">
                  <div className="question">
                    <div
                      className="mb-3 lead fw-bold"
                      dangerouslySetInnerHTML={{
                        __html: `Q${p.practiceCurrentIndex + 1}. ${TextFormatter.formatQuestionText(
                          q.text
                        )}`,
                      }}
                    ></div>
                    <div id="practice-options">
                      {q.options.map((opt, idx) => {
                        const isSelected = currentAnswer?.answer === idx;
                        let cls = "option shadow-sm";
                        if (submitted) {
                          if (idx === cIdx) cls += " correct-answer-label";
                          if (isSelected && idx !== cIdx) cls += " incorrect-answer-label";
                        }
                        return (
                          <label key={idx} className={cls}>
                            <input
                              type="radio"
                              name="pQ"
                              value={idx}
                              checked={isSelected || false}
                              disabled={submitted}
                              onChange={() => selectAnswer(idx)}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="mt-4 mb-2 animate-fade-in">
                      <div className="surety-label">Confidence Level</div>
                      <div
                        className="surety-matrix shadow-sm"
                        role="radiogroup"
                        aria-label="Confidence Level"
                      >
                        {[100, 75, 50, 0].map((val) => (
                          <div
                            key={val}
                            className={`surety-opt surety-${val} ${
                              currentSurety === val ? "selected" : ""
                            }`}
                            role="radio"
                            tabIndex={0}
                            aria-checked={currentSurety === val}
                            aria-label={`${val}% Confidence`}
                            onClick={() => selectSurety(val)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                selectSurety(val);
                              }
                            }}
                          >
                            {val}%
                          </div>
                        ))}
                      </div>
                    </div>

                    {submitted && q.explanation && (
                      <div
                        className="explanation shadow-sm mt-3 animate-fade-in"
                        dangerouslySetInnerHTML={{
                          __html: `<strong> Explanation:</strong> <br>${q.explanation}`,
                        }}
                      ></div>
                    )}
                  </div>
                </div>

                <div className="d-flex justify-content-between mt-4">
                  <button
                    className="btn btn-secondary-custom px-4"
                    onClick={() => navPractice(-1)}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-outline-secondary px-4"
                    disabled={submitted}
                    onClick={clearPracticeSelection}
                  >
                    Clear
                  </button>
                  <button
                    className="btn btn-secondary-custom px-4"
                    onClick={() => navPractice(1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar palette */}
          <div className="col-lg-4">
            <div className="quiz-nav-sidebar" id="quiz-nav">
              <div className="nav-header">Question Palette</div>
              <div className="timer-container shadow-sm border-info">
                <span className="timer-label">Time Remaining</span>
                <div className={`timer-value ${timerDisplay.low ? "text-danger" : ""}`}>
                  {timerDisplay.text}
                </div>
              </div>
              <div id="practice-nav-container" className="nav-grid">
                {p.practiceQuizData.map((_, i) => {
                  const uAns = p.practiceUserAnswers[i];
                  const marked = p.practiceMarkedForReview[i];
                  let cls = "nav-item shadow-sm";
                  if (i === p.practiceCurrentIndex) cls += " active";
                  if (submitted) {
                    const qq = p.practiceQuizData[i];
                    const cc = getCorrectIndex(qq);
                    if (!uAns || uAns.answer === undefined || uAns.answer === -1)
                      cls += " unattempted";
                    else if (uAns.answer === cc) cls += " correct-nav";
                    else cls += " incorrect-nav";
                  } else {
                    if (uAns && uAns.answer !== undefined && uAns.answer !== -1)
                      cls += " attempted";
                    if (marked) cls += " marked-nav";
                  }
                  return (
                    <div
                      key={i}
                      className={cls}
                      role="button"
                      tabIndex={0}
                      aria-label={`Question ${i + 1}`}
                      onClick={() => jumpTo(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          jumpTo(i);
                        }
                      }}
                    >
                      {i + 1}
                    </div>
                  );
                })}
              </div>
              {!submitted && (
                <button
                  className="btn btn-secondary-custom w-100 mt-4 rounded-pill py-2 fw-bold text-white"
                  onClick={() => submitPractice(false)}
                >
                  Finish Practice
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Practice result summary card (verbatim markup) ---------- */
function PracticeResultCard({ summary }) {
  const { score, totalPossibleMarks, accuracy, negativeDrain, correct, incorrect, unattempted } =
    summary;
  return (
    <div className="card border-0 shadow-sm rounded-4 p-4 text-center animate-fade-in mb-4">
      <h4 className="fw-bold text-primary mb-3">Practice Result</h4>
      <div className="row g-2 mb-3">
        <div className="col-12 col-md-4">
          <div className="p-2 bg-primary text-white rounded shadow-sm">
            <small
              className="text-white-50 d-block text-uppercase fw-bold"
              style={{ fontSize: "0.7rem" }}
            >
              Total Score
            </small>
            <h3 className="fw-bold m-0">
              {score.toFixed(2)}{" "}
              <span className="fs-6 text-white-50">/ {totalPossibleMarks}</span>
            </h3>
          </div>
        </div>
        <div className="col-6 col-md-4">
          <div className="p-2 bg-light rounded shadow-sm border-start border-4 border-success">
            <small
              className="text-muted d-block text-uppercase fw-bold"
              style={{ fontSize: "0.7rem" }}
            >
              Accuracy
            </small>
            <h4 className="fw-bold m-0 text-success">{accuracy}%</h4>
          </div>
        </div>
        <div className="col-6 col-md-4">
          <div className="p-2 bg-light rounded shadow-sm border-start border-4 border-danger">
            <small
              className="text-muted d-block text-uppercase fw-bold"
              style={{ fontSize: "0.7rem" }}
            >
              Neg. Drain
            </small>
            <h4 className="fw-bold m-0 text-danger">{negativeDrain}%</h4>
          </div>
        </div>
      </div>
      <div className="row g-2">
        <div className="col-4">
          <div className="p-2 bg-light rounded">
            <small className="text-muted d-block">Correct</small>
            <span className="fw-bold text-success">{correct}</span>
          </div>
        </div>
        <div className="col-4">
          <div className="p-2 bg-light rounded">
            <small className="text-muted d-block">Incorrect</small>
            <span className="fw-bold text-danger">{incorrect}</span>
          </div>
        </div>
        <div className="col-4">
          <div className="p-2 bg-light rounded">
            <small className="text-muted d-block">Skipped</small>
            <span className="fw-bold text-secondary">{unattempted}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
