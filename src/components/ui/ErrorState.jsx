import React from "react";

export default function ErrorState({ message, onRetry }) {
  return (
    <div className="page empty">
      <div className="empty__icon">⚠️</div>
      <h3>Something went wrong</h3>
      <p>{message || "An unexpected error occurred."}</p>
      {onRetry && (
        <button className="btn btn--primary" onClick={onRetry} style={{ marginTop: 14 }}>
          Try Again
        </button>
      )}
    </div>
  );
}
