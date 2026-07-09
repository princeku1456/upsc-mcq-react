import React from "react";
import { useApp } from "../../store";

export default function ChapterCard({ subject, cId, cName, fullChapId, pastData }) {
  const { loadQuiz } = useApp();

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column" }}>
      <h3 className="card__title" style={{ marginBottom: 14, flex: 1, wordBreak: "break-word", overflowWrap: "break-word", hyphens: "auto" }}>
        {cName}
      </h3>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn btn--primary"
          style={{ flex: 1 }}
          onClick={() => loadQuiz(subject, fullChapId, cName)}
        >
          {pastData ? "Retake Test" : "Start Test"}
        </button>
        {pastData && (
          <button
            className="btn btn--success"
            onClick={() => loadQuiz(subject, fullChapId, cName, true, pastData, "chapters")}
            title="Review Test"
            style={{ padding: "0 12px" }}
          >
            👁 Review
          </button>
        )}
      </div>
    </div>
  );
}
