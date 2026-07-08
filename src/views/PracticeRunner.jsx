/* =========================================
   PRACTICE RUNNER (ported from practice.js)
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
    resultSummary: null, 
  }).current;

  const timerRef = useRef(null);
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  const [phase, setPhase] = useState("loading");
  const [timerDisplay, setTimerDisplay] = useState({ text: "00:00", low: false });
  const submitRef = useRef(() => {});

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

  useEffect(() => {
    g.isPracticeMode = true;
    let cancelled = false;

    async function run() {
      const subject = viewParams.subject;
      const chapter = viewParams.chapter;
      const limit = viewParams.limit;

      if (!subject || !chapter) return;

      p.practiceSubject = subject;
      p.practiceChapter = chapter === "all" ? "All Topics" : chapter;
      p.practiceQuestionLimit = limit;
      p.practiceSubmitted = false;
      p.practiceMarkedForReview = {};

      try {
        const allPracticeData = DataManager.cache.practiceManifest || window.allPracticeData || {};
        const chapterIds = chapter === "all" ? Object.keys(allPracticeData[subject] || {}) : [chapter];

        const promises = chapterIds.map((chapId) => {
          const docId = subject.replace(/\s+/g, "_") + "_" + chapId;
          return DataManager.fetchPracticeQuestions(docId);
        });

        const results = await Promise.all(promises);
        const allQuestions = results.flat();
        if (cancelled) return;

        if (allQuestions.some(q => q === null)) {
          toastr.error("Failed to load some questions. Check your internet connection.");
          setPhase("error");
          return;
        }

        if (allQuestions.length === 0) {
          toastr.error("No questions available.");
          setPhase("error");
          return;
        }

        const randomized = [...allQuestions];
        const fetchLimit = Math.min(limit, randomized.length);
        
        for (let i = randomized.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [randomized[i], randomized[j]] = [randomized[j], randomized[i]];
        }
        
        p.practiceQuizData = randomized.slice(0, fetchLimit);
        p.practiceCurrentIndex = 0;
        p.practiceUserAnswers = {};
        p.resultSummary = null;

        setPhase("active");
        startPracticeTimer(fetchLimit);
      } catch (e) {
        console.error(e);
        toastr.error("Failed to load practice mode.");
        setPhase("error");
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [viewParams, g, p, startPracticeTimer]);

  const exitPractice = () => {
    if (timerRef.current) timerRef.current.stop();
    g.isPracticeMode = false;
    startPracticeSelection();
  };

  const nav = (step) => {
    const n = p.practiceCurrentIndex + step;
    if (n >= 0 && n < p.practiceQuizData.length) {
      p.practiceCurrentIndex = n;
      forceUpdate();
    }
  };

  const gotoQuestion = (idx) => {
    p.practiceCurrentIndex = idx;
    forceUpdate();
  };

  const selectAnswer = (idx) => {
    if (p.practiceSubmitted) return;
    if (!p.practiceUserAnswers[p.practiceCurrentIndex]) {
      p.practiceUserAnswers[p.practiceCurrentIndex] = { answer: idx, surety: 100 };
    } else {
      p.practiceUserAnswers[p.practiceCurrentIndex].answer = idx;
    }
    forceUpdate();
  };

  const selectSurety = (val) => {
    if (p.practiceSubmitted) return;
    if (!p.practiceUserAnswers[p.practiceCurrentIndex]) return;
    p.practiceUserAnswers[p.practiceCurrentIndex].surety = val;
    forceUpdate();
  };

  const clearSelection = () => {
    if (p.practiceSubmitted) return;
    delete p.practiceUserAnswers[p.practiceCurrentIndex];
    forceUpdate();
  };

  const toggleMarkForReview = () => {
    if (p.practiceSubmitted) return;
    if (p.practiceMarkedForReview[p.practiceCurrentIndex]) {
      delete p.practiceMarkedForReview[p.practiceCurrentIndex];
    } else {
      p.practiceMarkedForReview[p.practiceCurrentIndex] = true;
    }
    forceUpdate();
  };

  const submitPractice = useCallback(
    (forceSubmit = false) => {
      if (!forceSubmit && !window.confirm("Are you sure you want to end this practice session?")) return;

      if (timerRef.current) timerRef.current.stop();
      p.practiceSubmitted = true;

      let score = 0, correct = 0, incorrect = 0, unattempted = 0;
      const totalQ = p.practiceQuizData.length;

      p.practiceQuizData.forEach((q, i) => {
        const uAns = p.practiceUserAnswers[i];
        const cIdx = getCorrectIndex(q);

        if (uAns) {
          const isCorrect = uAns.answer === cIdx;
          p.practiceUserAnswers[i].isCorrect = isCorrect;
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

      const practiceResult = {
        userId: currentUser ? currentUser.uid : "guest",
        userEmail: currentUser ? currentUser.email : "guest",
        subject: p.practiceSubject,
        chapterId: `practice_${p.practiceChapter.replace(/\s+/g, "_")}_${Date.now()}`,
        chapterName: `Practice: ${p.practiceChapter} (${totalQ} Qs)`,
        score: finalScore,
        totalMarks: totalMarks,
        scorePercent: parseFloat(percentage),
        userAnswers: p.practiceUserAnswers,
        timestamp: now,
      };

      p.resultSummary = { correct, incorrect, unattempted, finalScore, totalMarks, percentage };
      forceUpdate();

      if (currentUser) {
        db.collection("practice_results")
          .add({
            ...practiceResult,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          })
          .then(() => {
            toastr.success("Practice result saved!");
            g.practiceHistory.unshift({ ...practiceResult, timestamp: now });
            if (g.practiceHistory.length > 20) g.practiceHistory.pop();
            g.dashboardDataLoaded = true;
            bumpHistory();
            DataManager.invalidateCache(`practice_history_${currentUser.uid}`);
          })
          .catch((e) => console.error("Error saving practice:", e));
      } else {
        toastr.info("Logged out. Result not saved.");
      }
    },
    [p, currentUser, g, bumpHistory]
  );
  submitRef.current = submitPractice;

  if (phase === "loading") {
    return (
      <div className="page empty">
        <div className="spinner"></div>
        <p style={{ marginTop: 14 }}>Loading Practice Session...</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="page empty">
        <div className="empty__icon">⚠️</div>
        <h3>Session Failed</h3>
        <button className="btn btn--ghost" onClick={exitPractice} style={{ marginTop: 14 }}>
          ← Back
        </button>
      </div>
    );
  }

  const question = p.practiceQuizData[p.practiceCurrentIndex];
  if (!question) return null;
  const correctIndex = getCorrectIndex(question);
  const uAnsCurrent = p.practiceUserAnswers[p.practiceCurrentIndex];
  const currentSurety = uAnsCurrent?.surety;
  const isMarked = !!p.practiceMarkedForReview[p.practiceCurrentIndex];

  return (
    <div className="runner">
      <div className="runner__bar">
        <button className="btn btn--ghost" onClick={exitPractice}>← Exit Practice</button>
        <h4 style={{ margin: 0, color: "var(--ink-soft)" }}>Practice: {p.practiceChapter}</h4>
        <div className={`timer-pill ${timerDisplay.low ? "timer-pill--low" : ""}`}>
          ⏳ {timerDisplay.text || "00:00"}
        </div>
      </div>

      <div className="runner__grid">
        <div className="card" style={{ padding: "24px 28px" }}>
          <div className="card__head">
            <h2 className="card__title">Question {p.practiceCurrentIndex + 1}</h2>
            <button
              className={`btn btn--sm ${isMarked ? "btn--subtle" : "btn--ghost"}`}
              onClick={toggleMarkForReview}
            >
              {isMarked ? "★ Unmark" : "☆ Mark for Review"}
            </button>
          </div>

          <div>
            <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 24, lineHeight: 1.6 }}>
              <span dangerouslySetInnerHTML={{ __html: TextFormatter.formatQuestionText(question.text) }} />
            </div>

            <div className="grid">
              {question.options.map((opt, idx) => {
                const isSelected = uAnsCurrent && uAnsCurrent.answer === idx;
                let optionClass = "option";
                let omrClass = "omr";

                if (p.practiceSubmitted) {
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
                    disabled={p.practiceSubmitted}
                    onClick={() => { if (!p.practiceSubmitted) selectAnswer(idx); }}
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
                    disabled={p.practiceSubmitted}
                    onClick={() => { if (!p.practiceSubmitted) selectSurety(val); }}
                  >
                    {val}% Confidence
                  </button>
                ))}
              </div>
            </div>

            {p.practiceSubmitted && question.explanation && (
              <div className="explanation" style={{ marginTop: 24 }}>
                <strong style={{ display: "block", marginBottom: 4 }}>💡 Explanation:</strong>
                <span dangerouslySetInnerHTML={{ __html: question.explanation }} />
              </div>
            )}
          </div>

          <div className="runner__nav">
            <button
              className="btn btn--ghost"
              disabled={p.practiceCurrentIndex === 0}
              onClick={() => nav(-1)}
            >
              Previous
            </button>
            <button
              className="btn btn--ghost"
              disabled={p.practiceSubmitted}
              onClick={clearSelection}
            >
              Clear
            </button>
            <button
              className="btn btn--ghost"
              disabled={p.practiceCurrentIndex === p.practiceQuizData.length - 1}
              onClick={() => nav(1)}
            >
              Next
            </button>
          </div>

          {p.resultSummary && (
            <div style={{ marginTop: 30, borderTop: "1px dashed var(--line)", paddingTop: 30 }}>
              <div className="score-strip">
                <div className="score-strip__big">Score: {p.resultSummary.finalScore}</div>
                <div>
                  <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>Total Marks</div>
                  <div style={{ fontWeight: 600 }}>{p.resultSummary.totalMarks}</div>
                </div>
                <div>
                  <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>Accuracy</div>
                  <div style={{ fontWeight: 600 }}>{p.resultSummary.percentage}%</div>
                </div>
              </div>

              <div className="stats-grid">
                <Stat variant="leaf" label="Correct" value={p.resultSummary.correct} />
                <Stat variant="stamp" label="Incorrect" value={p.resultSummary.incorrect} />
                <Stat label="Unattempted" value={p.resultSummary.unattempted} />
              </div>

              <button className="btn btn--primary btn--block" style={{ marginTop: 20 }} onClick={exitPractice}>
                Finish Session
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
              {p.practiceQuizData.map((_, i) => {
                let cls = "palette__cell";
                if (i === p.practiceCurrentIndex) cls += " palette__cell--current";
                
                const uAns = p.practiceUserAnswers[i];
                const marked = p.practiceMarkedForReview[i];
                
                if (p.practiceSubmitted) {
                  const cIdx = getCorrectIndex(p.practiceQuizData[i]);
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

            {!p.practiceSubmitted && (
              <div style={{ marginTop: 24 }}>
                <button className="btn btn--success btn--block" onClick={() => submitPractice(false)}>
                  End Practice
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ variant, label, value }) {
  const vClass = variant ? `stat--${variant}` : "";
  return (
    <div className={`stat ${vClass}`}>
      <span className="eyebrow">{label}</span>
      <span className="stat__value">{value}</span>
    </div>
  );
}
