import React from "react";

export default function AdminUserManagement({ userEmails, searchEmail, attempts, attemptsLoading, displayEmail, onSearchEmailChange, onSearch, onViewAttempt, onDeleteAttempt }) {
  return (
    <div className="card shadow-sm border-0 rounded-4 p-4 mb-5">
      <h5 className="fw-bold text-primary mb-4">
        <i className="bi bi-people-fill me-2"></i>Manage User Attempts
      </h5>
      <div className="row g-3">
        <div className="col-md-10">
          <select className="form-select form-select-lg" value={searchEmail} onChange={(e) => onSearchEmailChange(e.target.value)}>
            <option value="" disabled>Select a User Email...</option>
            {userEmails.map((email) => <option key={email} value={email}>{email}</option>)}
          </select>
        </div>
        <div className="col-md-2">
          <button className="btn btn-secondary-custom w-100 py-2 btn-lg" onClick={onSearch}>Search 🔍</button>
        </div>
      </div>

      {(attemptsLoading || attempts !== null) && (
        <div className="mt-4">
          <hr />
          <h6 className="fw-bold mb-3">Attempts for: <span className="text-secondary">{displayEmail}</span></h6>
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead className="table-light">
                <tr><th>Date</th><th>Subject</th><th>Test Name</th><th>Score</th><th className="text-end">Action</th></tr>
              </thead>
              <tbody>
                {attemptsLoading ? (
                  <tr><td colSpan="5" className="text-center py-4"><div className="spinner-border spinner-border-sm text-primary"></div> Fetching user records...</td></tr>
                ) : attempts && attempts.length === 0 ? (
                  <tr><td colSpan="5" className="text-center text-muted py-4">No attempts found for this user.</td></tr>
                ) : (
                  (attempts || []).map((data) => (
                    <tr key={data.id}>
                      <td><small className="text-muted">{data.date}</small></td>
                      <td><span className="fw-bold">{data.subject}</span></td>
                      <td>{data.chapterName}</td>
                      <td><span className="badge bg-primary">{data.scorePercent}%</span></td>
                      <td className="text-end">
                        <button className="btn btn-outline-primary btn-sm me-1" onClick={() => onViewAttempt(data.id, data.chapterId, data.chapterName)}>
                          <i className="bi bi-eye"></i> View
                        </button>
                        <button className="btn btn-outline-danger btn-sm" onClick={() => onDeleteAttempt(data.id, data.chapterName, data)}>
                          <i className="bi bi-trash"></i> Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
