import React from "react";
import Badge from "../../components/ui/Badge";
import { useGeminiAI } from "../../hooks/useGeminiAI";
import { useGeminiKey } from "../../hooks/useDataManager";

export default function AIMentor({ userHistory, conceptGapText }) {
  const { aiState, generateAIReview } = useGeminiAI();
  const { fetchGeminiKey } = useGeminiKey();

  const handleGenerate = async () => {
    const key = await fetchGeminiKey();
    await generateAIReview(key, userHistory, conceptGapText);
  };

  return (
    <div className="card" style={{ marginBottom: 28, background: "linear-gradient(135deg, var(--card) 0%, var(--pen-soft) 100%)" }}>
      <div className="card__head">
        <h2 className="card__title">✨ AI Personalized Mentor</h2>
        <Badge variant="pen">Gemini</Badge>
      </div>
      <div id="ai-review-content" style={{ minHeight: 60, marginBottom: 16 }}>
        {aiState.html ? (
          <div dangerouslySetInnerHTML={{ __html: aiState.html }} />
        ) : (
          <p style={{ color: "var(--ink-soft)", margin: 0 }}>
            Get a personalized performance review powered by Google Gemini AI. Analyze your weak spots, negative marking patterns, and confidence gaps.
          </p>
        )}
      </div>
      <button className="btn btn--primary" onClick={handleGenerate} disabled={aiState.loading}>
        {aiState.loading ? (
          <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></div> Analyzing...</>
        ) : (
          "⚡ Analyze My Performance"
        )}
      </button>
    </div>
  );
}
