import React from "react";
import { getCorrectIndex, TextFormatter } from "../lib/helpers";

export default function AdminQuestionCard({ question, qIdx, results, accuracy, resultsWithUserNames }) {
  const optionBuckets = question.options.map(() => []);
  const skippedUsers = [];
  const correctIndex = getCorrectIndex(question);

  resultsWithUserNames.forEach((item) => {
    const res = item.original;
    const userName = item.userName;
    const choice = res.userAnswers ? res.userAnswers[qIdx] : null;
    const suretyVal = choice && choice.surety !== undefined ? choice.surety + "%" : "N/A";
    if (!choice || choice.answer === undefined || choice.answer === -1) {
      skippedUsers.push({ name: userName, surety: suretyVal });
    } else if (optionBuckets[choice.answer]) {
      optionBuckets[choice.answer].push({ name: userName, surety: suretyVal });
    }
  });

  return (
    <div
      id={`q-card-${qIdx}`}
      className={`card mb-5 shadow-sm border-0 rounded-4 admin-q-card ${accuracy < 40 ? "high-error" : ""}`}
    >
      <div className="card-body p-4">
        <div className="d-flex justify-content-between mb-3">
          <span className="badge bg-primary bg-opacity-10 text-primary">Question {qIdx + 1}</span>
          <span className="badge bg-light text-dark border">Accuracy: {accuracy}%</span>
        </div>
        <div className="fw-bold mb-4 h5" dangerouslySetInnerHTML={{ __html: TextFormatter.formatQuestionText(question.text) }}></div>
        <div className="row g-4">
          <div className="col-12">
            {question.options.map((opt, oIdx) => {
              const isCorrect = oIdx === correctIndex;
              const users = optionBuckets[oIdx];
              const percent = results.length > 0 ? Math.round((users.length / results.length) * 100) : 0;
              return (
                <div key={oIdx} className={`p-3 border rounded-3 mb-2 ${isCorrect ? "bg-success bg-opacity-10 border-success" : "bg-white"}`}>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <span className={`badge ${isCorrect ? "bg-success" : "bg-secondary"} me-2`}>
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span className={isCorrect ? "fw-bold text-success" : ""}>{opt}</span>
                    </div>
                    <span className="fw-bold text-muted small">{users.length} Users ({percent}%)</span>
                  </div>
                  <div className="d-flex flex-wrap gap-2 mt-2 user-list-container">
                    {users.map((u, ui) => (
                      <span key={ui} className="badge user-tag d-flex align-items-center gap-1">
                        {u.name}{" "}
                        <strong className="text-primary" style={{ fontSize: "0.65rem", borderLeft: "1px solid #ddd", paddingLeft: "4px" }}>{u.surety}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="mt-3 p-2 bg-light rounded-3 border-dashed border-2">
              <small className="text-muted fw-bold">⚪ SKIPPED ({skippedUsers.length})</small>
              <div className="d-flex flex-wrap gap-1 mt-1">
                {skippedUsers.length === 0 ? "None" : skippedUsers.map((u, ui) => (
                  <span key={ui} className="badge user-tag border-secondary text-secondary">
                    {u.name} <small className="ms-1 opacity-50">({u.surety})</small>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="col-12">
            <div className="explanation-box mb-3">
              <h6 className="fw-bold text-warning-emphasis"><i className="bi bi-lightbulb"></i> Explanation:</h6>
              <p className="small m-0">{question.explanation || "No explanation."}</p>
            </div>
            <div className="p-3 bg-primary bg-opacity-10 rounded-3">
              <small className="fw-bold text-primary d-block mb-1">DISCUSSION TIP</small>
              <p className="small m-0 text-primary-emphasis">
                {accuracy < 40 ? "⚠️ High error rate with mixed confidence." : "✅ Concept generally understood."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
