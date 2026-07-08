/* =========================================
   TAKE TEST — Subjects & Chapters + Revision Test
   ========================================= */
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../store";
import { DataManager } from "../lib/dataManager";
import { getCorrectIndex } from "../lib/helpers";
import { toastr } from "../lib/toastr";

/* ---------- SUBJECTS ---------- */
export function SubjectsView() {
  const { g } = useApp();
  const navigate = useNavigate();
  const [allQuizData, setAllQuizData] = useState(
    DataManager.cache.quizManifest || window.allQuizData || null
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!allQuizData) {
        const data = await DataManager.fetchQuizManifest();
        if (cancelled) return;
        if (data) {
          setAllQuizData(data);
          window.allQuizData = data;
        } else {
          setFailed(true);
          toastr.error("Failed to load subject data.");
        }
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [allQuizData]);

  if (failed) {
    return (
      <div className="page empty">
        <div className="empty__icon">⚠️</div>
        <h3>Failed to load</h3>
        <p>Could not fetch subject list.</p>
        <button className="btn btn--ghost" onClick={() => navigate("/dashboard")} style={{ marginTop: 14 }}>
          ← Back
        </button>
      </div>
    );
  }

  if (!allQuizData) {
    return (
      <div className="page empty">
        <div className="spinner"></div>
        <p style={{ marginTop: 14 }}>Loading Subjects...</p>
      </div>
    );
  }

  const subjectsList = Object.keys(allQuizData);
  if (subjectsList.length === 0) {
    return (
      <div className="page empty">
        <div className="empty__icon">📚</div>
        <h3>No Subjects Found</h3>
        <p>Check the data configuration.</p>
        <button className="btn btn--ghost" onClick={() => navigate("/dashboard")} style={{ marginTop: 14 }}>
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <button className="btn btn--ghost" onClick={() => navigate("/dashboard")}>
          ← Back to Dashboard
        </button>
      </div>

      <div className="dash__hero">
        <h1>Select a Subject</h1>
        <p>Choose a subject to view available tests and chapters.</p>
      </div>

      <div className="subjects-grid">
        {subjectsList.map((subject) => {
          let subjTests = 0;
          if (allQuizData[subject]) subjTests = Object.keys(allQuizData[subject]).length;
          
          let attempted = 0;
          if (g.userHistory) {
            const set = new Set();
            g.userHistory.forEach((r) => {
              if (r.subject === subject) set.add(r.chapterId);
            });
            attempted = set.size;
          }
          const progress = subjTests > 0 ? (attempted / subjTests) * 100 : 0;

          return (
            <div
              key={subject}
              className="card action-card"
              style={{ padding: "20px 16px" }}
              onClick={() => navigate(`/subjects/${encodeURIComponent(subject)}`)}
            >
              <h3 className="card__title" style={{ marginBottom: 4 }}>{subject}</h3>
              <div style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 14 }}>
                {subjTests} Tests Available
              </div>
              <div className="progress">
                <div
                  className="progress__fill progress__fill--leaf"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div style={{ fontSize: 11, textAlign: "right", marginTop: 6, color: "var(--ink-soft)" }}>
                {Math.round(progress)}% Completed
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
  const { subjectKey } = useParams();
  const { loadQuiz, g } = useApp();
  const navigate = useNavigate();
  
  const [allQuizData, setAllQuizData] = useState(
    DataManager.cache.quizManifest || window.allQuizData || null
  );
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!allQuizData) {
        const data = await DataManager.fetchQuizManifest();
        if (cancelled) return;
        if (data) {
          setAllQuizData(data);
          window.allQuizData = data;
        }
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [allQuizData]);

  if (!allQuizData) {
    return (
      <div className="page empty">
        <div className="spinner"></div>
        <p style={{ marginTop: 14 }}>Loading Chapters...</p>
      </div>
    );
  }

  const subject = decodeURIComponent(subjectKey || "");
  const chaptersMap = allQuizData[subject];

  if (!chaptersMap) {
    return (
      <div className="page empty">
        <div className="empty__icon">⚠️</div>
        <h3>Subject Not Found</h3>
        <p>The subject "{subject}" does not exist.</p>
        <button className="btn btn--ghost" onClick={() => navigate("/subjects")} style={{ marginTop: 14 }}>
          ← Back to Subjects
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <button className="btn btn--ghost" onClick={() => navigate("/subjects")}>
          ← Back to Subjects
        </button>
      </div>

      <div className="dash__hero">
        <h1>{subject}</h1>
        <p>Select a chapter test or generate a revision test.</p>
      </div>

      <div className="card" style={{ marginBottom: 24, background: "linear-gradient(135deg, var(--card) 0%, var(--pen-soft) 100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <h3 style={{ margin: 0 }}>🧠 Smart Revision Test</h3>
            <p style={{ color: "var(--ink-soft)", margin: "4px 0 0", fontSize: 14 }}>
              Generate a custom test using questions you previously got wrong.
            </p>
          </div>
          <button className="btn btn--primary" onClick={() => setRevisionModalOpen(true)}>
            Generate Revision Test
          </button>
        </div>
      </div>

      <div className="chapters-grid">
        {Object.entries(chaptersMap).map(([key, val]) => {
          let cId = key;
          let cName = val;

          // Robustly handle cases where val is an object or array
          if (typeof val === 'object' && val !== null) {
            cId = Array.isArray(chaptersMap) ? (val.id || val.testId || val.docId || key) : key;
            cName = val.title || val.name || val.chapterName || JSON.stringify(val);
          }
          if (typeof cName !== 'string' || !cName.trim()) {
            cName = `Test ${key}`;
          }

          // Check if user has already taken this test to enable Review Mode
          let pastData = null;
          if (g.userHistory) {
            // Find the most recent attempt for this chapter (check both real ID and old index-based ID)
            pastData = g.userHistory.find(r => r.chapterId === cId || r.chapterId === key || r.chapterName === cName);
          }

          return (
            <div key={cId} className="card" style={{ display: "flex", flexDirection: "column" }}>
              <h3 className="card__title" style={{ marginBottom: 14, flex: 1 }}>{cName}</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn--primary"
                  style={{ flex: 1 }}
                  onClick={() => loadQuiz(subject, cId, cName)}
                >
                  {pastData ? "Retake Test" : "Start Test"}
                </button>
                {pastData && (
                  <button
                    className="btn btn--success"
                    onClick={() => loadQuiz(subject, cId, cName, true, pastData, "chapters")}
                    title="Review Test"
                    style={{ padding: "0 12px" }}
                  >
                    👁 Review
                  </button>
                )}
                <button
                  className="btn btn--ghost"
                  onClick={() => navigate("/dashboard")}
                  title="View Stats"
                  style={{ padding: "0 12px" }}
                >
                  📊
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {revisionModalOpen && (
        <StartRevisionModal
          subject={subject}
          onClose={() => setRevisionModalOpen(false)}
        />
      )}
    </div>
  );
}

/* ---------- REVISION MODAL ---------- */
function StartRevisionModal({ subject, onClose }) {
  const { g, loadQuiz } = useApp();
  const [qs, setQs] = useState(10);
  const [includeMarked, setIncludeMarked] = useState(true);
  const [includeIncorrect, setIncludeIncorrect] = useState(true);
  const [includeUnattempted, setIncludeUnattempted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const historyItems = [...g.userHistory, ...g.practiceHistory].filter(
        (r) => r.subject === subject
      );

      if (historyItems.length === 0) {
        toastr.warning("No test history found for this subject.");
        setIsGenerating(false);
        return;
      }

      const eligibleMap = new Map();

      for (const res of historyItems) {
        try {
          const docId = res.chapterId;
          const questions = await DataManager.fetchQuizQuestions(docId);
          if (!questions || questions.length === 0) continue;

          questions.forEach((q, idx) => {
            const uAns = res.userAnswers ? res.userAnswers[idx] : null;
            const cIdx = getCorrectIndex(q);
            const markedStr =
              g.cache && g.cache[`quiz_progress_${docId}`]
                ? g.cache[`quiz_progress_${docId}`]
                : localStorage.getItem(`quiz_progress_${docId}`);
            let isMarked = false;
            if (markedStr) {
              try {
                const parsed = JSON.parse(markedStr);
                if (parsed.markedForReview && parsed.markedForReview[idx]) {
                  isMarked = true;
                }
              } catch (e) {}
            }

            let includeThis = false;
            if (includeMarked && isMarked) includeThis = true;
            if (includeIncorrect && uAns && uAns.answer !== cIdx)
              includeThis = true;
            if (includeUnattempted && !uAns) includeThis = true;

            if (includeThis) {
              const qKey = `${docId}_${idx}`;
              if (!eligibleMap.has(qKey)) {
                eligibleMap.set(qKey, q);
              }
            }
          });
        } catch (e) {
          console.error("Error fetching for revision:", e);
        }
      }

      const allEligible = Array.from(eligibleMap.values());
      if (allEligible.length === 0) {
        toastr.warning("No questions found matching your criteria.");
        setIsGenerating(false);
        return;
      }

      // Shuffle array
      for (let i = allEligible.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allEligible[i], allEligible[j]] = [allEligible[j], allEligible[i]];
      }

      const finalQs = allEligible.slice(0, qs);
      const revChapterId = `revision_${Date.now()}`;
      DataManager.cache[`quiz_data_${revChapterId}`] = finalQs;

      onClose();
      loadQuiz(subject, revChapterId, `Revision Test (${finalQs.length} Qs)`);
    } catch (e) {
      console.error(e);
      toastr.error("Failed to generate revision test.");
      setIsGenerating(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3 className="modal__title">Generate Revision Test</h3>
        <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>
          Create a custom test from {subject}.
        </p>

        <div className="login__field">
          <label>Number of Questions</label>
          <select
            className="form-select"
            value={qs}
            onChange={(e) => setQs(parseInt(e.target.value))}
            style={{
              border: "1.5px solid var(--line)",
              borderRadius: "var(--radius-sm)",
              background: "var(--card)",
              padding: "11px 13px",
              font: "inherit",
              width: "100%",
              color: "var(--ink)"
            }}
          >
            <option value={10}>10 Questions</option>
            <option value={20}>20 Questions</option>
            <option value={30}>30 Questions</option>
            <option value={50}>50 Questions</option>
          </select>
        </div>

        <div style={{ marginTop: 16 }}>
          <label className="eyebrow">Include Questions That Are:</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={includeIncorrect}
                onChange={(e) => setIncludeIncorrect(e.target.checked)}
              />
              Incorrect (Wrong Answers)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={includeMarked}
                onChange={(e) => setIncludeMarked(e.target.checked)}
              />
              Marked for Review
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={includeUnattempted}
                onChange={(e) => setIncludeUnattempted(e.target.checked)}
              />
              Unattempted
            </label>
          </div>
        </div>

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose} disabled={isGenerating}>
            Cancel
          </button>
          <button
            className="btn btn--primary"
            onClick={handleGenerate}
            disabled={isGenerating || (!includeIncorrect && !includeMarked && !includeUnattempted)}
          >
            {isGenerating ? "Generating..." : "Generate Test"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TestSelectionLayout({ children }) {
  return <>{children}</>;
}
