import React from "react";

export default function AdminTestAnalysis({ subjects, subject, chapters, chapterId, onSubjectChange, onChapterChange, onAnalyze }) {
  return (
    <div className="card shadow-sm border-0 rounded-4 p-4 mb-5">
      <h5 className="fw-bold text-primary mb-4">
        <i className="bi bi-search me-2"></i>Select Test to Analyze
      </h5>
      <div className="row g-3">
        <div className="col-md-5">
          <select className="form-select form-select-lg" value={subject} onChange={(e) => onSubjectChange(e.target.value)}>
            <option value="">-- Choose Subject --</option>
            {subjects.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
          </select>
        </div>
        <div className="col-md-5">
          <select className="form-select form-select-lg" value={chapterId} disabled={!subject} onChange={(e) => onChapterChange(e.target.value)}>
            <option value="">-- Choose Test --</option>
            {chapters.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="col-md-2">
          <button className="btn btn-primary-custom w-100 py-2 btn-lg" onClick={onAnalyze}>
            Analyze 🚀
          </button>
        </div>
      </div>
    </div>
  );
}
