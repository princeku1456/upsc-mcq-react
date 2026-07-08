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
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("all");
  const [questionLimit, setQuestionLimit] = useState(10);
  const [loading, setLoading] = useState(!allPracticeData);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!allPracticeData) {
        const data = await DataManager.fetchPracticeManifest();
        if (cancelled) return;
        if (data) {
          setAllPracticeData(data);
          window.allPracticeData = data;
        } else {
          toastr.error("Failed to load practice data.");
        }
        setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [allPracticeData]);

  if (loading) {
    return (
      <div className="page empty">
        <div className="spinner"></div>
        <p style={{ marginTop: 14 }}>Loading practice modules...</p>
      </div>
    );
  }

  if (!allPracticeData || Object.keys(allPracticeData).length === 0) {
    return (
      <div className="page empty">
        <div className="empty__icon">⚠️</div>
        <h3>No Practice Data</h3>
        <p>No practice modules are currently available.</p>
        <button className="btn btn--ghost" onClick={() => navigate("/dashboard")} style={{ marginTop: 14 }}>
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const subjects = Object.keys(allPracticeData);
  const currentSubjectData =
    selectedSubject && allPracticeData[selectedSubject]
      ? allPracticeData[selectedSubject]
      : {};
  const chapters = Object.keys(currentSubjectData);

  const handleStart = () => {
    if (!selectedSubject) {
      toastr.warning("Please select a subject first.");
      return;
    }
    loadPracticeQuiz(selectedSubject, selectedChapter, questionLimit);
  };

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <button className="btn btn--ghost" onClick={() => navigate("/dashboard")}>
          ← Back
        </button>
      </div>

      <div className="card" style={{ maxWidth: 500, margin: "0 auto" }}>
        <div className="card__head">
          <h2 className="card__title">🎯 Practice Configuration</h2>
        </div>
        <p style={{ color: "var(--ink-soft)", margin: "0 0 20px" }}>
          Select a subject, specific topics, and the number of questions to practice.
        </p>

        <div className="grid">
          <div className="login__field">
            <label>Subject</label>
            <select
              className="form-select"
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedChapter("all");
              }}
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
              <option value="">-- Select Subject --</option>
              {subjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="login__field">
            <label>Topic / Chapter</label>
            <select
              className="form-select"
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
              disabled={!selectedSubject || chapters.length === 0}
              style={{
                border: "1.5px solid var(--line)",
                borderRadius: "var(--radius-sm)",
                background: "var(--card)",
                padding: "11px 13px",
                font: "inherit",
                width: "100%",
                color: "var(--ink)",
                opacity: (!selectedSubject || chapters.length === 0) ? 0.5 : 1
              }}
            >
              <option value="all">All Topics (Mixed)</option>
              {chapters.map((key) => {
                const val = currentSubjectData[key];
                let cId = key;
                let label = val;
                
                if (typeof val === 'object' && val !== null) {
                  cId = Array.isArray(currentSubjectData) ? (val.id || val.testId || val.docId || key) : key;
                  label = val.title || val.name || val.chapterName || `Topic ${cId}`;
                }
                
                return (
                  <option key={cId} value={cId}>{label}</option>
                );
              })}
            </select>
          </div>

          <div className="login__field">
            <label>Number of Questions</label>
            <select
              className="form-select"
              value={questionLimit}
              onChange={(e) => setQuestionLimit(parseInt(e.target.value))}
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
              <option value={100}>100 Questions</option>
            </select>
          </div>

          <button
            className="btn btn--primary btn--block"
            onClick={handleStart}
            disabled={!selectedSubject}
            style={{ marginTop: 10, padding: "14px 20px" }}
          >
            Start Practice Session 🚀
          </button>
        </div>
      </div>
    </div>
  );
}
