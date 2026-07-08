/* =========================================
   PRACTICE CONFIG (ported from practice.js:
   renderPracticeUI / updatePracticeTopics / handleGeneratePractice)
   Subject / Topic / limit dropdowns; "All Topics"; same options.
   ========================================= */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../store";
import { DataManager } from "../lib/dataManager";
import { toastr } from "../lib/toastr";

export default function PracticeConfigView() {
  const { loadPracticeQuiz } = useApp();
  const navigate = useNavigate();

  const [allPracticeData, setAllPracticeData] = useState(
    DataManager.cache.practiceManifest || window.allPracticeData || null
  );
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!allPracticeData) {
        const data = await DataManager.fetchPracticeManifest();
        if (!cancelled && data) setAllPracticeData(data);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // updatePracticeTopics — reset topic when subject changes
  const onSubjectChange = (val) => {
    setSubject(val);
    setTopic("");
  };

  // handleGeneratePractice (verbatim validation)
  const handleGeneratePractice = () => {
    if (!subject || !topic) {
      toastr.error("Please select both a Subject and a Topic.");
      return;
    }
    loadPracticeQuiz(subject, topic, parseInt(limit));
  };

  if (!allPracticeData) {
    return (
      <section className="py-5" style={{ minHeight: "90vh" }}>
        <div className="container text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="mt-2 text-muted">Loading practice topics...</p>
        </div>
      </section>
    );
  }

  const chapters = subject ? allPracticeData[subject] || {} : {};

  return (
    <section className="py-5" style={{ minHeight: "90vh" }}>
      <div className="container">
        <button
          className="btn btn-primary-custom px-4 shadow mb-4"
          onClick={() => navigate("/dashboard")}
        >
          ← Back to Dashboard
        </button>
        <div className="text-center mb-5">
          <h2 className="fw-bold section-title text-primary">Practice MCQ</h2>
          <div
            className="title-underline mx-auto"
            style={{ background: "var(--secondary-color)" }}
          ></div>
          <p className="text-muted mt-3">
            Configure your custom practice session below.
          </p>
        </div>

        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6">
            <div className="card border-0 shadow-sm rounded-4 p-4">
              <div className="mb-3">
                <label className="form-label fw-bold text-muted small">
                  1. Select Subject
                </label>
                <select
                  className="form-select form-select-lg"
                  value={subject}
                  onChange={(e) => onSubjectChange(e.target.value)}
                >
                  <option value="" disabled>
                    Choose a Subject...
                  </option>
                  {Object.keys(allPracticeData).map((subj) => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold text-muted small">
                  2. Select Topic / Chapter
                </label>
                <select
                  className="form-select form-select-lg"
                  value={topic}
                  disabled={!subject}
                  onChange={(e) => setTopic(e.target.value)}
                >
                  <option value="" disabled>
                    {subject ? "Choose a Topic..." : "Select Subject first..."}
                  </option>
                  {subject && <option value="all">All Topics</option>}
                  {Object.keys(chapters).map((chapId) => (
                    <option key={chapId} value={chapId}>
                      {chapId}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="form-label fw-bold text-muted small">
                  3. Number of Questions
                </label>
                <select
                  className="form-select form-select-lg"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                >
                  {[10, 20, 30, 40, 50, 75, 100].map((n) => (
                    <option key={n} value={n}>
                      {n} Questions
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="btn btn-secondary-custom w-100 py-3 fw-bold fs-5"
                onClick={handleGeneratePractice}
              >
                Generate Practice
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
