import React, { useState } from "react";
import Modal from "../components/ui/Modal";
import Spinner from "../components/ui/Spinner";
import ErrorState from "../components/ui/ErrorState";

export default function AdminUserReviewModal({ modal, onClose }) {
  const { title, loading, error, data: d } = modal;

  return (
    <Modal title={title} size="xl" onClose={onClose}>
      {loading ? (
        <div className="text-center py-5">
          <Spinner />
          <p>Fetching test details...</p>
        </div>
      ) : error ? (
        <ErrorState message={`Error loading details: ${error}`} />
      ) : d ? (
        <ModalBody data={d} />
      ) : null}
    </Modal>
  );
}

function ModalBody({ data: d }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [subjFilter, setSubjFilter] = useState("all");

  const { resultData, userAnswers, questions, correctCount, incorrectCount, unattemptedCount, subjectStats } = d;
  const subjectKeys = Object.keys(subjectStats).sort();

  return (
    <>
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card bg-primary text-white border-0 shadow-sm h-100">
            <div className="card-body text-center p-3">
              <h6 className="opacity-75 mb-1">Score</h6>
              <h3 className="fw-bold mb-0">{resultData.scorePercent}%</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-success text-white border-0 shadow-sm h-100">
            <div className="card-body text-center p-3">
              <h6 className="opacity-75 mb-1">Correct</h6>
              <h3 className="fw-bold mb-0">{correctCount}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-danger text-white border-0 shadow-sm h-100">
            <div className="card-body text-center p-3">
              <h6 className="opacity-75 mb-1">Incorrect</h6>
              <h3 className="fw-bold mb-0">{incorrectCount}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-secondary text-white border-0 shadow-sm h-100">
            <div className="card-body text-center p-3">
              <h6 className="opacity-75 mb-1">Unattempted</h6>
              <h3 className="fw-bold mb-0">{unattemptedCount}</h3>
            </div>
          </div>
        </div>
      </div>

      {subjectKeys.length > 0 && (
        <div className="card mb-4 border-0 shadow-sm">
          <div className="card-header bg-white fw-bold">
            <i className="bi bi-bar-chart-fill me-2 text-primary"></i>Subject-wise Performance
          </div>
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 text-center align-middle">
              <thead className="table-light">
                <tr>
                  <th className="text-start">Subject</th><th>Total</th>
                  <th className="text-success">Correct</th><th className="text-danger">Incorrect</th>
                  <th className="text-secondary">Unattempted</th><th>Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {subjectKeys.map((subj) => {
                  const s = subjectStats[subj];
                  const attempted = s.correct + s.incorrect;
                  const acc = attempted > 0 ? Math.round((s.correct / attempted) * 100) : 0;
                  return (
                    <tr key={subj}>
                      <td className="text-start fw-bold">{subj}</td><td>{s.total}</td>
                      <td className="text-success">{s.correct}</td><td className="text-danger">{s.incorrect}</td>
                      <td className="text-secondary">{s.unattempted}</td>
                      <td>
                        <span className={`badge ${acc >= 70 ? "bg-success" : acc >= 40 ? "bg-warning text-dark" : "bg-danger"}`}>
                          {acc}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold m-0">Detailed Analysis</h5>
        <div className="btn-group btn-group-sm" role="group">
          {["all", "correct", "incorrect", "unattempted"].map((st) => {
            const color = st === "all" ? "primary" : st === "correct" ? "success" : st === "incorrect" ? "danger" : "secondary";
            return (
              <React.Fragment key={st}>
                <input
                  type="radio" className="btn-check" name="adminQFilter"
                  id={`btnradio-${st}`} autoComplete="off"
                  checked={statusFilter === st} onChange={() => setStatusFilter(st)}
                />
                <label className={`btn btn-outline-${color}`} htmlFor={`btnradio-${st}`}>
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </label>
              </React.Fragment>
            );
          })}
        </div>
        <select className="form-select form-select-sm w-auto ms-2" value={subjFilter} onChange={(e) => setSubjFilter(e.target.value)}>
          <option value="all">All Subjects</option>
          {subjectKeys.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="mt-2" id="admin-questions-list">
        {questions.map((q, index) => {
          const correctIndex = q.options.indexOf(q.correctAnswer) >= 0 ? q.options.indexOf(q.correctAnswer) : q.correctAnswer;
          const uAns = userAnswers[index];
          const attempted = uAns !== undefined;
          const isCorrect = attempted && uAns.answer === correctIndex;

          let statusBadge, borderClass, statusClass;
          if (!attempted) {
            statusBadge = <span className="badge bg-secondary mb-2">Unattempted</span>;
            borderClass = "border-secondary";
            statusClass = "unattempted";
          } else if (isCorrect) {
            statusBadge = <span className="badge bg-success mb-2">Correct</span>;
            borderClass = "border-success";
            statusClass = "correct";
          } else {
            statusBadge = <span className="badge bg-danger mb-2">Incorrect</span>;
            borderClass = "border-danger";
            statusClass = "incorrect";
          }

          const qSubj = q.subject ? q.subject.trim() : null;
          const statusMatch = statusFilter === "all" || statusFilter === statusClass;
          const subjMatch = subjFilter === "all" || subjFilter === qSubj;

          return (
            <div
              key={index}
              className={`card mb-4 border-0 shadow-sm border-start border-4 ${borderClass} admin-review-q-card ${!(statusMatch && subjMatch) ? "d-none" : ""}`}
            >
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <h6 className="fw-bold text-secondary mb-0">Question {index + 1}</h6>
                  <div>
                    {statusBadge}
                    {attempted && uAns.surety !== undefined && (
                      <span className="badge bg-info text-dark ms-2">Confidence: {uAns.surety}%</span>
                    )}
                  </div>
                </div>
                <div
                  className="mb-3 lead"
                  style={{ fontSize: "1.1rem" }}
                  dangerouslySetInnerHTML={{ __html: (q.text || q.question || "Missing question text") }}
                ></div>
                <div className="options-container ps-3">
                  {q.options.map((opt, optIdx) => {
                    let optClass = "p-2 mb-2 rounded border";
                    let icon;
                    if (optIdx === correctIndex) {
                      optClass += " bg-success text-white border-success";
                      icon = <i className="bi bi-check-circle-fill me-2"></i>;
                    } else if (attempted && uAns.answer === optIdx) {
                      optClass += " bg-danger text-white border-danger";
                      icon = <i className="bi bi-x-circle-fill me-2"></i>;
                    } else {
                      optClass += " bg-white text-dark";
                      icon = <i className="bi bi-circle me-2 text-muted"></i>;
                    }
                    return (
                      <div key={optIdx} className={optClass}>
                        {icon}<span dangerouslySetInnerHTML={{ __html: opt }}></span>
                      </div>
                    );
                  })}
                </div>
                {q.explanation && (
                  <div className="mt-3 p-3 bg-light rounded border-start border-warning border-4">
                    <h6 className="fw-bold text-warning-emphasis">
                      <i className="bi bi-lightbulb me-1"></i>Explanation
                    </h6>
                    <div className="small" dangerouslySetInnerHTML={{ __html: q.explanation }}></div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
