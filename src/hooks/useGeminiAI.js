import { useState, useCallback } from "react";
import { marked } from "marked";
import { AI_MODEL } from "../config/constants";
import { toastr } from "../lib/toastr";
import { computeHistoryAggregates, buildAIPrompt } from "../lib/statsEngine";

export function useGeminiAI() {
  const [state, setState] = useState({ loading: false, html: null, error: false });

  const generate = useCallback(async (apiKey, userHistory, conceptGapText) => {
    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
      toastr.warning("AI Service not configured. Please contact support.");
      return;
    }

    setState({
      loading: true,
      html: `<div class="empty"><div class="spinner"></div><p>Analyzing performance...</p></div>`,
      error: false,
    });

    try {
      const history = userHistory || [];
      if (history.length === 0) {
        throw new Error("No test history available to analyze.");
      }

      const aggregates = computeHistoryAggregates(history);
      const prompt = buildAIPrompt({ ...aggregates, conceptGapText });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || "Failed to fetch AI response");
      }

      const data = await response.json();
      const aiText = data.candidates[0].content.parts[0].text;
      const formattedText = marked.parse(aiText);

      setState({
        loading: false,
        html: `<div class="animate-fade-in markdown-content">${formattedText}</div>`,
        error: false,
      });
    } catch (error) {
      console.error("AI Error:", error);
      toastr.error("AI Analysis Failed: " + error.message);
      setState({
        loading: false,
        html: `<p style="color:var(--stamp)">Failed to generate review. Please check system configuration.</p>`,
        error: true,
      });
    }
  }, []);

  return { aiState: state, generateAIReview: generate };
}
