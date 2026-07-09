import React from "react";
import { useNavigate } from "react-router-dom";
import ProgressBar from "../../components/ui/ProgressBar";

export default function SubjectCard({ subject, subjTests, attempted, progress }) {
  const navigate = useNavigate();

  return (
    <div
      className="card action-card"
      style={{ padding: "20px 16px" }}
      onClick={() => navigate(`/subjects/${encodeURIComponent(subject)}`)}
    >
      <h3 className="card__title" style={{ marginBottom: 4 }}>{subject}</h3>
      <div style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 14 }}>
        {subjTests} Tests Available
      </div>
      <ProgressBar value={progress} variant={progress >= 100 ? "leaf" : "marker"} />
      <div style={{ fontSize: 11, textAlign: "right", marginTop: 6, color: "var(--ink-soft)" }}>
        {Math.round(progress)}% Completed
      </div>
    </div>
  );
}
