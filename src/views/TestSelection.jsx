/* =========================================
   TAKE TEST — Subjects & Chapters + Revision Test
   (ported from quiz.js: renderSubjects, renderChapters,
    openRevisionModal, generateRevisionTest)
   ========================================= */
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useApp } from "../store";
import { DataManager } from "../lib/dataManager";
import { getCorrectIndex } from "../lib/helpers";
import { toastr } from "../lib/toastr";

/* ---------- SUBJECTS ---------- */
export function SubjectsView() {
  const { g, showDashboard, showChapters } = useApp();
  const [allQuizData, setAllQuizData] = useState(
    DataManager.cache.quizManifest || window.allQuizData || null
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // If data isn't loaded yet, fetch it from Firestore
      if (!allQuizData) {
        const data = await DataManager.fetchQuizManifest();
        if (cancelled) return;
        if (data) setAllQuizData(data);
        else setFailed(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger text-center">
          Failed to load Quiz Data from Firebase!
        </div>
      </div>
    );
  }

  if (!allQuizData) {
    return (
      <div className="container">
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="mt-2 text-muted">Loading Subjects from Cloud...</p>
        </div>
      </div>
    );
  }

  // Sort and render subjects (verbatim comparator)
  const sortedSubjectKeys = Object.keys(allQuizData).sort((a, b) => {
    return a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  // OPTIMIZATION: Pre-calculate completed chapter IDs for O(1) lookup
  const completedChapterIds = new Set();
  if (g.userHistory) {
    g.userHistory.forEach((h) => completedChapterIds.add(h.chapterId));
  }

  return (
    <div className="container">
      <button
        className="btn btn-primary-custom px-4 shadow mb-4"
        onClick={showDashboard}
      >
        ← Back to Dashboard
      </button>
      <div className="text-center mb-4">
        <h4 className="fw-bold section-title">Select a Subject</h4>
        <div className="title-underline mx-auto"></div>
      </div>
      <div className="row justify-content-center g-4" id="subjects-row">
        {sortedSubjectKeys.map((subjectKey) => {
          const chapters = allQuizData[subjectKey];
          const totalChapters = Object.keys(chapters).length;
          const subjectPrefix = subjectKey.replace(/\s+/g, "_") + "_";

          const completedChaptersCount = Object.keys(chapters).filter(
            (chapId) => {
              const fullId = subjectPrefix + chapId;
              return completedChapterIds.has(fullId);
            }
          ).length;

          const progressPercent =
            totalChapters > 0
              ? Math.round((completedChaptersCount / totalChapters) * 100)
              : 0;
          const isCompleted = progressPercent === 100;

          return (
            <div className="col-md-4 col-lg-3 mb-4" key={subjectKey}>
              <div
                className={`card topic-card h-100 ${
                  isCompleted ? "subject-completed" : ""
                }`}
                style={{ cursor: "pointer" }}
                role="button"
                tabIndex={0}
                aria-label={`Select Subject: ${subjectKey}`}
                onClick={() => showChapters(subjectKey)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    showChapters(subjectKey);
                  }
                }}
              >
                <div className="card-body text-center p-4 d-flex flex-column">
                  <div className="display-4 mb-3">
                    {isCompleted ? "🏆" : "📖"}
                  </div>
                  {isCompleted && (
                    <div className="badge bg-success mb-2 animate-fade-in">
                      ✨ Completed
                    </div>
                  )}
                  <h5 className="card-title text-primary fw-bold">
                    {subjectKey}
                  </h5>
                  <p className="text-muted small mb-3">
                    {completedChaptersCount} / {totalChapters} Chapters Done
                  </p>
                  <div className="mt-auto">
                    <div
                      className="progress mb-2"
                      style={{
                        height: 25,
                        backgroundColor: "var(--border-color)",
                        borderRadius: 5,
                      }}
                    >
                      <div
                        className={`progress-bar ${
                          isCompleted ? "bg-success" : ""
                        }`}
                        role="progressbar"
                        style={{
                          width: `${progressPercent}%`,
                          ...(isCompleted
                            ? {}
                            : { backgroundColor: "var(--accent-color)" }),
                          borderRadius: 5,
                        }}
                      ></div>
                    </div>
                    <small
                      className={`fw-bold ${
                        isCompleted ? "text-success" : "text-secondary"
                      }`}
                    >
                      {progressPercent}% Complete
                    </small>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- CHAPTERS ---------- */
export function ChaptersView() {
  const {
    g,
    showTestSelection,
    loadQuiz,
    reviewTest,
    startRevisionTest,
  } = useApp();
  const { subjectKey: rawSubjectKey } = useParams();
  const subjectKey = decodeURIComponent(rawSubjectKey);
  const allQuizData =
    DataManager.cache.quizManifest || window.allQuizData || {};
  const [revisionOpen, setRevisionOpen] = useState(false);

  const chapters = allQuizData[subjectKey] || {};

  // FIX: Sort the chapter IDs numerically (verbatim)
  const sortedChapterIds = Object.keys(chapters).sort((a, b) => {
    return a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  // OPTIMIZATION: Create O(1) lookup map for user history
  const latestResultsMap = new Map();
  if (g.userHistory) {
    g.userHistory.forEach((h) => {
      if (!latestResultsMap.has(h.chapterId)) {
        latestResultsMap.set(h.chapterId, h);
      }
    });
  }

  return (
    <div className="container">
      <button
        className="btn btn-primary-custom px-4 shadow mb-4"
        onClick={showTestSelection}
      >
        ← Back to Subjects
      </button>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="text-start">
          <h4 className="fw-bold section-title mb-1">
            Chapters: {subjectKey}
          </h4>
          <div className="title-underline"></div>
        </div>
        <button
          className="btn btn-secondary-custom shadow-sm fw-bold"
          onClick={() => setRevisionOpen(true)}
        >
          <i className="bi bi-journal-text me-1"></i>Create Revision Test
        </button>
      </div>
      <div className="row" id="chapters-row">
        {sortedChapterIds.map((chapId) => {
          const subjectPrefix = subjectKey.replace(/\s+/g, "_") + "_";
          const fullChapterId = subjectPrefix + chapId;

          const latestResult = latestResultsMap.get(fullChapterId);
          const hasTaken = !!latestResult;
          const startBtnText = hasTaken ? "↻ Retake Test" : "🚀 Start Test";

          return (
            <div className="col-md-6 col-lg-4 mb-4" key={chapId}>
              <div className="card chapter-card h-100 border-0">
                <div className="card-body d-flex flex-column p-4">
                  <h5 className="card-title fw-bold text-dark">{chapId}</h5>
                  <div className="mt-auto">
                    <button
                      className="btn btn-primary-custom w-100 action-btn"
                      onClick={() =>
                        loadQuiz(subjectKey, chapId, encodeURIComponent(chapId))
                      }
                    >
                      {startBtnText}
                    </button>
                    {hasTaken && (
                      <button
                        className="btn btn-secondary-custom w-100 mt-2 review-perf-btn"
                        onClick={() => reviewTest(latestResult, "chapters")}
                      >
                        👁 Review Performance
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {revisionOpen && (
        <RevisionModal
          subjectKey={subjectKey}
          chapters={chapters}
          latestResultsMap={latestResultsMap}
          onClose={() => setRevisionOpen(false)}
          onGenerated={(questions) => {
            setRevisionOpen(false);
            startRevisionTest(subjectKey, questions);
          }}
        />
      )}
    </div>
  );
}

/* ---------- REVISION TEST MODAL ---------- */
function RevisionModal({ subjectKey, chapters, latestResultsMap, onClose, onGenerated }) {
  const [checked, setChecked] = useState({});
  const [filterType, setFilterType] = useState("all");
  const [generating, setGenerating] = useState(false);

  const sortedChapterIds = Object.keys(chapters).sort((a, b) => {
    return a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  /* generateRevisionTest — verbatim question-building logic */
  async function generateRevisionTest() {
    const selected = sortedChapterIds.filter((c) => checked[c]);
    if (selected.length === 0) {
      toastr.warning("Please select at least one test.");
      return;
    }

    setGenerating(true);

    try {
      let combinedQuestions = [];
      const subjectPrefix = subjectKey.replace(/\s+/g, "_") + "_";

      for (let i = 0; i < selected.length; i++) {
        const chapId = selected[i];
        const fullChapterId = subjectPrefix + chapId;
        const questions = await DataManager.fetchQuizQuestions(fullChapterId);

        if (questions && questions.length > 0) {
          const latestResult = latestResultsMap.get(fullChapterId);

          // Tag questions with subject if missing (for potential dashboard analytics)
          const taggedQuestions = questions
            .map((q, qIndex) => {
              let include = true;

              if (filterType !== "all") {
                if (!latestResult) {
                  // If user hasn't attempted this test, all questions are unattempted.
                  if (filterType === "correct" || filterType === "incorrect") {
                    include = false;
                  } else if (filterType === "unattempted") {
                    include = true;
                  }
                } else {
                  const uAns =
                    latestResult.userAnswers &&
                    latestResult.userAnswers[qIndex];
                  if (!uAns) {
                    include = filterType === "unattempted";
                  } else {
                    const correctIndex = getCorrectIndex(q);
                    const isCorrect = uAns.answer === correctIndex;
                    if (filterType === "correct" && !isCorrect) include = false;
                    if (filterType === "incorrect" && isCorrect) include = false;
                    if (filterType === "unattempted") include = false; // Because it was attempted
                  }
                }
              }

              if (include) {
                return {
                  ...q,
                  subject: q.subject || subjectKey,
                };
              }
              return null;
            })
            .filter((q) => q !== null);

          combinedQuestions = combinedQuestions.concat(taggedQuestions);
        }
      }

      if (combinedQuestions.length === 0) {
        toastr.error("No questions found matching your filter criteria.");
        setGenerating(false);
        return;
      }

      // Shuffle array using Fisher-Yates
      for (let i = combinedQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combinedQuestions[i], combinedQuestions[j]] = [
          combinedQuestions[j],
          combinedQuestions[i],
        ];
      }

      // Slice up to 100 questions
      const finalQuestions = combinedQuestions.slice(0, 100);

      setGenerating(false);
      onGenerated(finalQuestions);
    } catch (error) {
      console.error("Error generating revision test:", error);
      toastr.error("Failed to generate test.");
      setGenerating(false);
    }
  }

  return (
    <div className="app-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable app-modal-dialog">
        <div className="modal-content border-0 shadow-lg rounded-4">
          <div className="modal-header border-0 bg-light rounded-top-4">
            <h5 className="modal-title fw-bold text-primary">
              📝 Create Revision Test
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body p-4" style={{ overflowY: "auto", maxHeight: "55vh" }}>
            <p className="text-muted small mb-3">
              Select the tests you want to include in your revision test. Up to
              100 questions will be randomly selected from the chosen tests.
            </p>

            <div className="mb-3">
              <label htmlFor="revision-filter" className="form-label fw-bold text-secondary small">
                Filter Questions
              </label>
              <select
                className="form-select form-select-sm"
                id="revision-filter"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Questions</option>
                <option value="incorrect">Incorrect Only</option>
                <option value="correct">Correct Only</option>
                <option value="unattempted">Unattempted Only</option>
              </select>
            </div>

            <div id="revision-tests-list" className="list-group list-group-flush mb-3">
              {sortedChapterIds.map((chapId) => (
                <label
                  key={chapId}
                  className="list-group-item d-flex gap-2 align-items-center"
                >
                  <input
                    className="form-check-input flex-shrink-0 revision-checkbox"
                    type="checkbox"
                    value={chapId}
                    checked={!!checked[chapId]}
                    onChange={(e) =>
                      setChecked((c) => ({ ...c, [chapId]: e.target.checked }))
                    }
                  />
                  <span>{chapId}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="modal-footer border-0 justify-content-center pb-4">
            <button type="button" className="btn btn-secondary-custom px-4" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary-custom px-5 shadow"
              id="generate-revision-btn"
              disabled={generating}
              onClick={generateRevisionTest}
            >
              {generating ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-1"
                    role="status"
                    aria-hidden="true"
                  ></span>{" "}
                  Generating...
                </>
              ) : (
                "🚀 Generate Test"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
