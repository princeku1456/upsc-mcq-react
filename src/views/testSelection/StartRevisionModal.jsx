import React, { useState } from "react";
import { useApp } from "../../store";
import { DataManager } from "../../lib/dataManager";
import { getCorrectIndex } from "../../lib/helpers";
import { toastr } from "../../lib/toastr";
import { useQuizQuestions } from "../../hooks/useDataManager";
import { REVISION_QUESTION_OPTIONS } from "../../config/constants";
import Modal from "../../components/ui/Modal";

export default function StartRevisionModal({ subject, onClose }) {
  const { g, loadQuiz } = useApp();
  const [qs, setQs] = useState(10);
  const [includeMarked, setIncludeMarked] = useState(true);
  const [includeIncorrect, setIncludeIncorrect] = useState(true);
  const [includeUnattempted, setIncludeUnattempted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const { fetchQuestions } = useQuizQuestions(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const historyItems = g.userHistory.filter((r) => r.subject === subject);
      if (historyItems.length === 0) {
        toastr.warning("No test history found for this subject.");
        setIsGenerating(false);
        return;
      }

      const eligibleMap = new Map();

      for (const res of historyItems) {
        try {
          const docId = res.chapterId;
          const questions = await fetchQuestions(docId);
          if (!questions || questions.length === 0) continue;

          questions.forEach((q, idx) => {
            const uAns = res.userAnswers ? res.userAnswers[idx] : null;
            const cIdx = getCorrectIndex(q);
            const markedStr = DataManager.cache[`quiz_progress_${docId}`] || localStorage.getItem(`quiz_progress_${docId}`);
            let isMarked = false;
            if (markedStr) {
              try {
                const parsed = JSON.parse(markedStr);
                if (parsed.markedForReview && parsed.markedForReview[idx]) isMarked = true;
              } catch (e) {}
            }

            let includeThis = false;
            if (includeMarked && isMarked) includeThis = true;
            if (includeIncorrect && uAns && uAns.answer !== cIdx) includeThis = true;
            if (includeUnattempted && !uAns) includeThis = true;

            if (includeThis && !eligibleMap.has(`${docId}_${idx}`)) {
              eligibleMap.set(`${docId}_${idx}`, q);
            }
          });
        } catch (e) {
          console.error("Error fetching for revision:", e);
        }
      }

      const allEligible = Array.from(eligibleMap.values());
      if (allEligible.length === 0) {
        toastr.warning("No questions found matching your criteria.");
        setIsGenerating(false);
        return;
      }

      for (let i = allEligible.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allEligible[i], allEligible[j]] = [allEligible[j], allEligible[i]];
      }

      const finalQs = allEligible.slice(0, qs);
      const revChapterId = `revision_${Date.now()}`;
      DataManager.cache[`quiz_data_${revChapterId}`] = finalQs;

      onClose();
      loadQuiz(subject, revChapterId, `Revision Test (${finalQs.length} Qs)`);
    } catch (e) {
      console.error(e);
      toastr.error("Failed to generate revision test.");
      setIsGenerating(false);
    }
  };

  const canGenerate = includeIncorrect || includeMarked || includeUnattempted;

  return (
    <Modal
      title="Generate Revision Test"
      onClose={onClose}
      actions={
        <>
          <button className="btn btn--ghost" onClick={onClose} disabled={isGenerating}>Cancel</button>
          <button className="btn btn--primary" onClick={handleGenerate} disabled={isGenerating || !canGenerate}>
            {isGenerating ? "Generating..." : "Generate Test"}
          </button>
        </>
      }
    >
      <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>
        Create a custom test from {subject}.
      </p>

      <div className="login__field">
        <label>Number of Questions</label>
        <select
          className="form-select"
          value={qs}
          onChange={(e) => setQs(parseInt(e.target.value))}
          style={{
            border: "1.5px solid var(--line)", borderRadius: "var(--radius-sm)",
            background: "var(--card)", padding: "11px 13px", font: "inherit",
            width: "100%", color: "var(--ink)",
          }}
        >
          {REVISION_QUESTION_OPTIONS.map((n) => (
            <option key={n} value={n}>{n} Questions</option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 16 }}>
        <label className="eyebrow">Include Questions That Are:</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={includeIncorrect} onChange={(e) => setIncludeIncorrect(e.target.checked)} />
            Incorrect (Wrong Answers)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={includeMarked} onChange={(e) => setIncludeMarked(e.target.checked)} />
            Marked for Review
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={includeUnattempted} onChange={(e) => setIncludeUnattempted(e.target.checked)} />
            Unattempted
          </label>
        </div>
      </div>
    </Modal>
  );
}
