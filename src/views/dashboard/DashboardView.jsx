import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../store";
import { DataManager } from "../../lib/dataManager";
import { DifficultyHelper } from "../../lib/helpers";
import { toastr } from "../../lib/toastr";
import DashboardStats from "./DashboardStats";
import AIMentor from "./AIMentor";
import DashboardCharts from "./DashboardCharts";

export default function DashboardView() {
  const { currentUser, g, theme } = useApp();
  const navigate = useNavigate();

  const [loaded, setLoaded] = useState(g.dashboardDataLoaded);
  const [conceptGap, setConceptGap] = useState({ text: "0%", cls: "stat--pen" });

  useEffect(() => {
    let cancelled = false;
    async function loadUserDashboard(forceRefresh = false) {
      if (!currentUser || !currentUser.emailVerified) return;
      if (!forceRefresh && g.dashboardDataLoaded && g.userHistory.length > 0) {
        setLoaded(true);
        return;
      }
      try {
        const historyData = await DataManager.syncUserHistory(currentUser.uid, forceRefresh);
        if (cancelled) return;
        if (historyData) g.userHistory = historyData;
        if (historyData) { g.dashboardDataLoaded = true; setLoaded(true); }
      } catch (error) {
        console.error("Error loading dashboard:", error);
        toastr.error("Failed to load performance data.");
      }
    }
    loadUserDashboard();
    return () => { cancelled = true; };
  }, [currentUser, g]);

  useEffect(() => {
    let cancelled = false;
    async function updateConceptGapStat(results) {
      setConceptGap((cg) => ({ ...cg, text: "..." }));
      try {
        const uniqueChapters = [...new Set(results.map((r) => r.chapterId))];
        const statsMap = {};
        await Promise.all(uniqueChapters.map(async (id) => {
          const stats = await DataManager.fetchGlobalStats(id);
          if (stats) statsMap[id] = stats;
        }));
        if (cancelled) return;
        let sillyMistakes = 0;
        let totalQuestionsAttempted = 0;
        results.forEach((res) => {
          const stats = statsMap[res.chapterId];
          if (!stats || !res.userAnswers) return;
          Object.entries(res.userAnswers).forEach(([index, ans]) => {
            totalQuestionsAttempted++;
            if (!ans.isCorrect) {
              const qIdx = parseInt(index);
              const commCorrect = (stats.correctCounts && stats.correctCounts[qIdx]) || 0;
              const commTotal = stats.totalAttempts || 0;
              const diffInfo = DifficultyHelper.calculate(commCorrect, commTotal);
              if (diffInfo.label === "Easy") sillyMistakes++;
            }
          });
        });
        const gapPercent = totalQuestionsAttempted
          ? ((sillyMistakes / totalQuestionsAttempted) * 100).toFixed(1) : 0;
        setConceptGap({
          text: gapPercent + "%",
          cls: gapPercent > 15 ? "stat--stamp" : "stat--leaf",
        });
      } catch (error) {
        console.error("Concept gap calculation error:", error);
        setConceptGap({ text: "N/A", cls: "stat--pen" });
      }
    }
    if (loaded) updateConceptGapStat([...g.userHistory]);
    return () => { cancelled = true; };
  }, [loaded, g.userHistory]);

  return (
    <div className="page">
      <div className="dash__hero" style={{ marginBottom: 28 }}>
        <h1>My Dashboard</h1>
        <p>Your performance analytics and learning path.</p>
      </div>

      <DashboardStats userHistory={g.userHistory} conceptGap={conceptGap} />

      <div className="action-grid" style={{ marginBottom: 28 }}>
        <div className="card action-card" onClick={() => navigate("/subjects")}>
          <div className="action-card__icon">🚀</div>
          <div className="action-card__label hl" style={{ color: "var(--leaf)" }}>Take Test</div>
        </div>
      </div>

      <AIMentor userHistory={[...g.userHistory]} conceptGapText={conceptGap.text} />

      <DashboardCharts chartData={g.userHistory} loaded={loaded} theme={theme} />
    </div>
  );
}
