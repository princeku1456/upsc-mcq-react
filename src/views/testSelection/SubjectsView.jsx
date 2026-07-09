import React, { useEffect } from "react";
import { useApp } from "../../store";
import { useQuizManifest } from "../../hooks/useDataManager";
import { toastr } from "../../lib/toastr";
import EmptyState from "../../components/ui/EmptyState";
import Spinner from "../../components/ui/Spinner";
import SubjectCard from "./SubjectCard";

export default function SubjectsView() {
  const { g } = useApp();
  const { manifest: allQuizData, loading, error, fetchManifest } = useQuizManifest();

  useEffect(() => {
    if (!allQuizData && !loading && !error) fetchManifest();
  }, [allQuizData, loading, error, fetchManifest]);

  useEffect(() => {
    if (error) toastr.error("Failed to load subject data.");
  }, [error]);

  if (error) return <EmptyState icon="⚠️" title="Failed to load" message="Could not fetch subject list." />;
  if (!allQuizData) return <Spinner text="Loading Subjects..." />;

  const subjectsList = Object.keys(allQuizData);
  if (subjectsList.length === 0) {
    return <EmptyState icon="📚" title="No Subjects Found" message="Check the data configuration." />;
  }

  return (
    <div className="page">
      <div className="dash__hero">
        <h1>Select a Subject</h1>
        <p>Choose a subject to view available tests and chapters.</p>
      </div>

      <div className="subjects-grid">
        {subjectsList.map((subject) => {
          let subjTests = 0;
          if (allQuizData[subject]) subjTests = Object.keys(allQuizData[subject]).length;

          let attempted = 0;
          if (g.userHistory) {
            const set = new Set();
            g.userHistory.forEach((r) => {
              if (r.subject === subject) set.add(r.chapterId);
            });
            attempted = set.size;
          }
          const progress = subjTests > 0 ? (attempted / subjTests) * 100 : 0;

          return (
            <SubjectCard
              key={subject}
              subject={subject}
              subjTests={subjTests}
              attempted={attempted}
              progress={progress}
            />
          );
        })}
      </div>
    </div>
  );
}
