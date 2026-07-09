import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../../store";
import { useQuizManifest } from "../../hooks/useDataManager";
import Spinner from "../../components/ui/Spinner";
import EmptyState from "../../components/ui/EmptyState";
import ChapterCard from "./ChapterCard";
import StartRevisionModal from "./StartRevisionModal";

export default function ChaptersView() {
  const { subjectKey } = useParams();
  const { g } = useApp();
  const navigate = useNavigate();

  const { manifest: allQuizData, loading, error, fetchManifest } = useQuizManifest();
  const [revisionModalOpen, setRevisionModalOpen] = React.useState(false);

  useEffect(() => {
    if (!allQuizData && !loading && !error) fetchManifest();
  }, [allQuizData, loading, error, fetchManifest]);

  if (!allQuizData) return <Spinner text="Loading Chapters..." />;

  const subject = decodeURIComponent(subjectKey || "");
  const chaptersMap = allQuizData[subject];

  if (!chaptersMap) {
    return <EmptyState icon="⚠️" title="Subject Not Found" message={`The subject "${subject}" does not exist.`} />;
  }

  return (
    <div className="page">
      <div className="dash__hero">
        <h1>{subject}</h1>
        <p>Select a chapter test or generate a revision test.</p>
      </div>

      <div className="card" style={{ marginBottom: 24, background: "linear-gradient(135deg, var(--card) 0%, var(--pen-soft) 100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <h3 style={{ margin: 0 }}>🧠 Smart Revision Test</h3>
            <p style={{ color: "var(--ink-soft)", margin: "4px 0 0", fontSize: 14 }}>
              Generate a custom test using questions you previously got wrong.
            </p>
          </div>
          <button className="btn btn--primary" onClick={() => setRevisionModalOpen(true)}>
            Generate Revision Test
          </button>
        </div>
      </div>

      <div className="chapters-grid">
        {Object.entries(chaptersMap).map(([key, val]) => {
          let cId = key;
          let cName = key;

          if (typeof val === "string" && val.trim()) {
            cName = val;
          } else if (typeof val === "object" && val !== null) {
            cId = val.id || val.testId || val.docId || key;
            cName = val.title || val.name || val.chapterName || key;
          }

          const subjectPrefix = subject.replace(/\s+/g, "_");
          const fullChapId = cId.includes(subjectPrefix) ? cId : `${subjectPrefix}_${cId}`;

          let pastData = null;
          if (g.userHistory) {
            pastData = g.userHistory.find(
              (r) => r.chapterId === fullChapId || r.chapterId === cId || r.chapterId === key || r.chapterName === cName
            );
          }

          return (
            <ChapterCard
              key={cId}
              subject={subject}
              cId={cId}
              cName={cName}
              fullChapId={fullChapId}
              pastData={pastData}
            />
          );
        })}
      </div>

      {revisionModalOpen && (
        <StartRevisionModal subject={subject} onClose={() => setRevisionModalOpen(false)} />
      )}
    </div>
  );
}
