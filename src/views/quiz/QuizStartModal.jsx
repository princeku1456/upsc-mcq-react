import React from "react";
import Modal from "../../components/ui/Modal";
import Stat from "../../components/ui/Stat";

export default function QuizStartModal({ subject, chapterName, questionCount, hasResumeData, onStart, onCancel }) {
  return (
    <Modal
      title="Ready to Start?"
      onClose={onCancel}
      actions={
        <>
          <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn--primary" onClick={onStart}>
            {hasResumeData ? "Resume Test" : "Start Test"}
          </button>
        </>
      }
    >
      <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>
        {subject} &rsaquo; {chapterName}
      </p>
      <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        <Stat label="Questions" value={questionCount} />
        {hasResumeData && (
          <div className="stat stat--pen">
            <span className="eyebrow">Status</span>
            <span className="stat__value" style={{ fontSize: 18 }}>In Progress</span>
            <span className="stat__sub">Resuming from previous state</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
